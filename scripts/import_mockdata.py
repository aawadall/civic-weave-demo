#!/usr/bin/env python3
"""
Import CMPAC mock data into the Civic Weave database.

This script imports:
- 500 volunteers from cmpac_volunteers_simulation.csv
- 50 projects from cmpac_projects_simulation.json
"""

import csv
import json
import psycopg2
from psycopg2.extras import execute_values
import ast
import sys

# Database connection parameters
DB_CONFIG = {
    'host': 'localhost',
    'port': 5432,
    'database': 'civic_weave',
    'user': 'postgres',
    'password': 'postgres'
}

# File paths
VOLUNTEERS_CSV = '/home/arashad/src/civic-weave-demo/mockdata/cmpac_volunteers_simulation.csv'
PROJECTS_JSON = '/home/arashad/src/civic-weave-demo/mockdata/cmpac_projects_simulation.json'

# City coordinates (Canadian cities)
CITY_COORDS = {
    'Toronto': (43.6532, -79.3832),
    'Ottawa': (45.4215, -75.6972),
    'Mississauga': (43.5890, -79.6441),
    'Hamilton': (43.2557, -79.8711),
    'Calgary': (51.0447, -114.0719),
    'London': (42.9849, -81.2453),
    'Montreal': (45.5017, -73.5673),
    'Vancouver': (49.2827, -123.1207),
    'Winnipeg': (49.8951, -97.1384),
    'Edmonton': (53.5461, -113.4938),
    'Quebec City': (46.8139, -71.2080),
    'Victoria': (48.4284, -123.3656),
}


def connect_db():
    """Connect to PostgreSQL database."""
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        print("✓ Connected to database")
        return conn
    except Exception as e:
        print(f"✗ Failed to connect to database: {e}")
        sys.exit(1)


def clear_existing_data(conn):
    """Remove existing generated volunteers and sample projects."""
    cur = conn.cursor()

    print("\nCleaning existing data...")

    # Remove generated volunteers
    cur.execute("""
        DELETE FROM volunteer_skills
        WHERE volunteer_id IN (
            SELECT id FROM users WHERE email LIKE '%@volunteers.org'
        )
    """)
    deleted_skills = cur.rowcount

    cur.execute("DELETE FROM users WHERE email LIKE '%@volunteers.org'")
    deleted_volunteers = cur.rowcount

    # Remove sample projects
    cur.execute("""
        DELETE FROM project_skills
        WHERE project_id IN (
            SELECT id FROM projects
            WHERE name LIKE 'Community Garden%'
               OR name LIKE 'Youth Coding%'
               OR name LIKE 'Food Bank%'
               OR name LIKE 'Senior Tech%'
               OR name LIKE 'Environmental Data%'
        )
    """)

    cur.execute("""
        DELETE FROM projects
        WHERE name LIKE 'Community Garden%'
           OR name LIKE 'Youth Coding%'
           OR name LIKE 'Food Bank%'
           OR name LIKE 'Senior Tech%'
           OR name LIKE 'Environmental Data%'
    """)
    deleted_projects = cur.rowcount

    conn.commit()
    print(f"✓ Removed {deleted_volunteers} volunteers, {deleted_skills} skill assignments, {deleted_projects} projects")


def import_skills(conn, skill_names):
    """Import skills if they don't exist."""
    cur = conn.cursor()

    print("\nImporting skills...")
    skill_map = {}

    for skill_name in skill_names:
        # Check if skill exists
        cur.execute("SELECT id FROM skills WHERE LOWER(name) = LOWER(%s)", (skill_name,))
        result = cur.fetchone()

        if result:
            skill_map[skill_name.lower()] = result[0]
        else:
            # Create new skill with category 'Community'
            cur.execute("""
                INSERT INTO skills (name, description, category)
                VALUES (%s, %s, 'Community')
                RETURNING id
            """, (skill_name.title(), f"{skill_name.title()} skill"))
            skill_map[skill_name.lower()] = cur.fetchone()[0]

    conn.commit()
    print(f"✓ Processed {len(skill_names)} unique skills")
    return skill_map


def import_volunteers(conn, skill_map):
    """Import volunteers from CSV file."""
    cur = conn.cursor()

    print("\nImporting volunteers...")

    with open(VOLUNTEERS_CSV, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)

        volunteer_count = 0
        skill_assignment_count = 0

        for row in reader:
            name = row['Name']
            location = row['Location']
            province = row.get('Province', 'Unknown')  # Handle new Province column
            skills_str = row['Skills']

            # Generate email
            email = f"{name.lower().replace(' ', '.')}.{volunteer_count}@cmpac.org"

            # Get coordinates for location
            lat, lon = CITY_COORDS.get(location, (45.4215, -75.6972))  # Default to Ottawa

            # Parse skills (Python dict format)
            try:
                skills_dict = ast.literal_eval(skills_str)
            except:
                print(f"Warning: Could not parse skills for {name}: {skills_str}")
                skills_dict = {}

            # Insert volunteer with province information
            cur.execute("""
                INSERT INTO users (email, name, role, profile_complete, latitude, longitude, location_name)
                VALUES (%s, %s, 'volunteer', true, %s, %s, %s)
                RETURNING id
            """, (email, name, lat, lon, f"{location}, {province}, Canada"))

            volunteer_id = cur.fetchone()[0]
            volunteer_count += 1

            # Insert skills
            for skill_name, proficiency in skills_dict.items():
                skill_id = skill_map.get(skill_name.lower())
                if skill_id:
                    cur.execute("""
                        INSERT INTO volunteer_skills (volunteer_id, skill_id, claimed, score)
                        VALUES (%s, %s, true, %s)
                        ON CONFLICT (volunteer_id, skill_id) DO NOTHING
                    """, (volunteer_id, skill_id, float(proficiency)))
                    skill_assignment_count += 1

            if volunteer_count % 100 == 0:
                print(f"  Imported {volunteer_count} volunteers...")

    conn.commit()
    print(f"✓ Imported {volunteer_count} volunteers with {skill_assignment_count} skill assignments")


def import_projects(conn, skill_map):
    """Import projects from JSON file."""
    cur = conn.cursor()

    print("\nImporting projects...")

    with open(PROJECTS_JSON, 'r', encoding='utf-8') as f:
        projects_data = json.load(f)

    # Get coordinator ID
    cur.execute("SELECT id FROM users WHERE role = 'coordinator' LIMIT 1")
    coordinator_id = cur.fetchone()[0]

    project_count = 0
    task_count = 0

    for project_data in projects_data:
        project_name = project_data['name']
        description = project_data['description']
        locations = project_data.get('locations', [])
        tasks = project_data.get('tasks', [])

        # Use first location for project location (now includes province)
        primary_location = locations[0] if locations else 'Toronto, Ontario'
        
        # Extract city name for coordinates lookup
        city_name = primary_location.split(',')[0].strip()
        lat, lon = CITY_COORDS.get(city_name, (43.6532, -79.3832))

        # Insert project with full location including province
        cur.execute("""
            INSERT INTO projects (
                name, description, coordinator_id,
                latitude, longitude, location_name,
                status, max_volunteers
            )
            VALUES (%s, %s, %s, %s, %s, %s, 'active', 20)
            RETURNING id
        """, (
            project_name,
            description,
            coordinator_id,
            lat, lon,
            f"{primary_location}, Canada"
        ))

        project_id = cur.fetchone()[0]
        project_count += 1

        # Aggregate skills from all tasks
        project_skills = {}
        for task in tasks:
            skills_required = task.get('skills_required', {})
            for skill_name, weight in skills_required.items():
                # Use max weight if skill appears in multiple tasks
                if skill_name.lower() in project_skills:
                    project_skills[skill_name.lower()] = max(
                        project_skills[skill_name.lower()],
                        float(weight)
                    )
                else:
                    project_skills[skill_name.lower()] = float(weight)
            task_count += 1

        # Insert project skills
        for skill_name, weight in project_skills.items():
            skill_id = skill_map.get(skill_name.lower())
            if skill_id:
                cur.execute("""
                    INSERT INTO project_skills (project_id, skill_id, required, weight)
                    VALUES (%s, %s, %s, %s)
                """, (project_id, skill_id, weight > 0.7, weight))

    conn.commit()
    print(f"✓ Imported {project_count} projects with {task_count} total tasks")


def refresh_vectors(conn):
    """Refresh materialized view for skill vectors."""
    cur = conn.cursor()

    print("\nRefreshing skill vectors...")
    cur.execute("REFRESH MATERIALIZED VIEW volunteer_skill_vectors")
    conn.commit()
    print("✓ Materialized view refreshed")


def show_summary(conn):
    """Show import summary statistics."""
    cur = conn.cursor()

    print("\n" + "="*60)
    print("IMPORT SUMMARY")
    print("="*60)

    # Volunteer stats
    cur.execute("SELECT COUNT(*) FROM users WHERE role = 'volunteer'")
    volunteer_count = cur.fetchone()[0]

    cur.execute("SELECT COUNT(*) FROM volunteer_skills")
    skill_assignments = cur.fetchone()[0]

    cur.execute("""
        SELECT ROUND(AVG(cnt), 2)
        FROM (SELECT COUNT(*) as cnt FROM volunteer_skills GROUP BY volunteer_id) sub
    """)
    avg_skills = cur.fetchone()[0]

    # Project stats
    cur.execute("SELECT COUNT(*) FROM projects")
    project_count = cur.fetchone()[0]

    cur.execute("SELECT COUNT(*) FROM project_skills")
    project_skill_count = cur.fetchone()[0]

    # Skill stats
    cur.execute("SELECT COUNT(*) FROM skills")
    total_skills = cur.fetchone()[0]

    print(f"Volunteers:              {volunteer_count}")
    print(f"Skill Assignments:       {skill_assignments}")
    print(f"Avg Skills/Volunteer:    {avg_skills}")
    print(f"Projects:                {project_count}")
    print(f"Project Skills:          {project_skill_count}")
    print(f"Total Unique Skills:     {total_skills}")
    print("="*60)

    # Show top skills
    print("\nTop 10 Skills by Popularity:")
    cur.execute("""
        SELECT s.name, COUNT(vs.volunteer_id) as volunteers
        FROM skills s
        LEFT JOIN volunteer_skills vs ON s.id = vs.skill_id
        GROUP BY s.name
        ORDER BY volunteers DESC
        LIMIT 10
    """)

    for skill_name, count in cur.fetchall():
        print(f"  {skill_name:30s} {count:4d} volunteers")

    print("="*60 + "\n")


def main():
    """Main import process."""
    print("\n" + "="*60)
    print("CMPAC Mock Data Import")
    print("="*60)

    # Connect to database
    conn = connect_db()

    try:
        # Clear existing generated data
        clear_existing_data(conn)

        # Extract all unique skills from both files
        print("\nExtracting skills from mock data...")
        all_skills = set()

        # Skills from volunteers
        with open(VOLUNTEERS_CSV, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                try:
                    skills_dict = ast.literal_eval(row['Skills'])
                    all_skills.update(skills_dict.keys())
                except:
                    pass

        # Skills from projects
        with open(PROJECTS_JSON, 'r', encoding='utf-8') as f:
            projects = json.load(f)
            for project in projects:
                for task in project.get('tasks', []):
                    all_skills.update(task.get('skills_required', {}).keys())

        print(f"✓ Found {len(all_skills)} unique skills")

        # Import skills
        skill_map = import_skills(conn, all_skills)

        # Import volunteers
        import_volunteers(conn, skill_map)

        # Import projects
        import_projects(conn, skill_map)

        # Refresh vectors
        refresh_vectors(conn)

        # Show summary
        show_summary(conn)

        print("✓ Import completed successfully!\n")

    except Exception as e:
        conn.rollback()
        print(f"\n✗ Import failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

    finally:
        conn.close()


if __name__ == '__main__':
    main()
