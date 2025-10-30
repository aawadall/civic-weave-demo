#!/usr/bin/env python3
"""
Batch matching script for pre-computing volunteer-project matches.
This script should be run periodically (e.g., every 6-24 hours) to refresh matches.
"""

import os
import sys
import json
import logging
import argparse
from datetime import datetime
from typing import List, Dict, Any, Tuple
import numpy as np
import psycopg2
from psycopg2.extras import RealDictCursor
from sklearn.metrics.pairwise import cosine_similarity
from math import radians, cos, sin, asin, sqrt

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('batch_matching.log'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

# Database configuration
DB_CONFIG = {
    'host': os.getenv('DB_HOST', 'localhost'),
    'port': os.getenv('DB_PORT', '5432'),
    'user': os.getenv('DB_USER', 'postgres'),
    'password': os.getenv('DB_PASSWORD', 'postgres'),
    'database': os.getenv('DB_NAME', 'civic_weave')
}

def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate the great circle distance between two points on Earth in kilometers."""
    # Convert decimal degrees to radians
    lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
    
    # Haversine formula
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
    c = 2 * asin(sqrt(a))
    
    # Radius of earth in kilometers
    r = 6371
    return c * r

def get_volunteer_skill_vector(volunteer_id: str, cursor) -> np.ndarray:
    """Get skill vector for a volunteer."""
    query = """
        SELECT skill_id, score
        FROM volunteer_skills
        WHERE volunteer_id = %s AND claimed = TRUE
    """
    cursor.execute(query, (volunteer_id,))
    skills = cursor.fetchall()
    
    # Create a vector of all possible skills (dimension 1000)
    vector = np.zeros(1000)
    for skill in skills:
        # Use skill_id hash to determine position in vector
        position = hash(skill['skill_id']) % 1000
        vector[position] = skill['score']
    
    return vector

def get_project_skill_vector(project_id: str, cursor) -> np.ndarray:
    """Get skill vector for a project."""
    query = """
        SELECT skill_id, weight
        FROM project_skills
        WHERE project_id = %s
    """
    cursor.execute(query, (project_id,))
    skills = cursor.fetchall()
    
    # Create a vector of all possible skills (dimension 1000)
    vector = np.zeros(1000)
    for skill in skills:
        # Use skill_id hash to determine position in vector
        position = hash(skill['skill_id']) % 1000
        vector[position] = skill['weight']
    
    return vector

def get_matched_skills(volunteer_id: str, project_id: str, cursor) -> List[str]:
    """Get list of matched skill names between volunteer and project."""
    query = """
        SELECT DISTINCT s.name
        FROM volunteer_skills vs
        JOIN project_skills ps ON vs.skill_id = ps.skill_id
        JOIN skills s ON vs.skill_id = s.id
        WHERE vs.volunteer_id = %s
          AND ps.project_id = %s
          AND vs.claimed = TRUE
        ORDER BY s.name
    """
    cursor.execute(query, (volunteer_id, project_id))
    return [row['name'] for row in cursor.fetchall()]

def calculate_combined_score(skill_score: float, distance_km: float, 
                           skill_weight: float = 0.7, distance_weight: float = 0.3,
                           max_distance: float = 100) -> float:
    """Calculate combined score from skill similarity and distance."""
    # Normalize distance score (closer is better)
    distance_score = max(0, 1 - (distance_km / max_distance)) if distance_km <= max_distance else 0
    
    return skill_weight * skill_score + distance_weight * distance_score

def is_same_region(project_location: str, volunteer_location: str) -> bool:
    """Check if project and volunteer are in the same region (national exception)."""
    if not project_location or not volunteer_location:
        return False
    
    # Canadian provinces and territories
    canadian_regions = [
        'Canada', 'Ontario', 'Alberta', 'British Columbia', 'Quebec', 'Manitoba',
        'Saskatchewan', 'Nova Scotia', 'New Brunswick', 'Newfoundland',
        'Prince Edward Island', 'Northwest Territories', 'Yukon', 'Nunavut'
    ]
    
    project_upper = project_location.upper()
    volunteer_upper = volunteer_location.upper()
    
    for region in canadian_regions:
        if region.upper() in project_upper and region.upper() in volunteer_upper:
            return True
    
    return False

def get_enrolled_volunteers(cursor) -> set:
    """Get set of volunteer-project pairs that are already enrolled."""
    cursor.execute("""
        SELECT volunteer_id, project_id 
        FROM volunteer_enrollments 
        WHERE status = 'active'
    """)
    return {(row['volunteer_id'], row['project_id']) for row in cursor.fetchall()}

def refresh_matches(skill_weight: float = 0.7, distance_weight: float = 0.3, 
                   max_distance: float = 100, batch_size: int = 1000) -> int:
    """Refresh all project-volunteer matches with tiered matching."""
    logger.info("Starting tiered batch matching refresh...")
    
    try:
        # Connect to database
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # Get all active projects
        cursor.execute("""
            SELECT id, name, latitude, longitude, location_name 
            FROM projects 
            WHERE status = 'active'
        """)
        projects = cursor.fetchall()
        logger.info(f"Found {len(projects)} active projects")
        
        # Get all volunteers with location data
        cursor.execute("""
            SELECT id, name, latitude, longitude, location_name 
            FROM users 
            WHERE role = 'volunteer' 
              AND latitude IS NOT NULL 
              AND longitude IS NOT NULL
        """)
        volunteers = cursor.fetchall()
        logger.info(f"Found {len(volunteers)} volunteers with location data")
        
        # Get enrolled volunteer-project pairs (Tier 1: Exclude enrolled)
        enrolled_pairs = get_enrolled_volunteers(cursor)
        logger.info(f"Found {len(enrolled_pairs)} existing enrollments to exclude")
        
        # Clear existing matches
        cursor.execute("DELETE FROM project_volunteer_matches")
        logger.info("Cleared existing matches")
        
        # Process matches in batches
        total_matches = 0
        matches_to_insert = []
        
        for i, project in enumerate(projects):
            if i % 10 == 0:
                logger.info(f"Processing project {i+1}/{len(projects)}: {project['name']}")
            
            project_vector = get_project_skill_vector(project['id'], cursor)
            
            for volunteer in volunteers:
                # Tier 1: Skip if volunteer is already enrolled in this project
                if (volunteer['id'], project['id']) in enrolled_pairs:
                    continue
                
                volunteer_vector = get_volunteer_skill_vector(volunteer['id'], cursor)
                
                # Calculate skill similarity using cosine similarity
                if np.linalg.norm(volunteer_vector) > 0 and np.linalg.norm(project_vector) > 0:
                    skill_score = cosine_similarity([volunteer_vector], [project_vector])[0][0]
                else:
                    skill_score = 0.0
                
                # Calculate distance
                distance_km = haversine_distance(
                    project['latitude'], project['longitude'],
                    volunteer['latitude'], volunteer['longitude']
                )
                
                # Skip if distance is too far
                if distance_km > 500:  # Maximum 500km radius
                    continue
                
                # Tier 2 & 3: Calculate combined score based on region
                if is_same_region(project['location_name'], volunteer['location_name']):
                    # National/same region exception: prioritize skills (70%) over distance (30%)
                    combined_score = 0.7 * skill_score + 0.3 * max(0, 1 - (distance_km / 100))
                else:
                    # Different regions: prioritize distance (60%) over skills (40%)
                    combined_score = 0.4 * skill_score + 0.6 * max(0, 1 - (distance_km / 100))
                
                # Skip if combined score is too low
                if combined_score < 0.1:
                    continue
                
                # Get matched skills
                matched_skills = get_matched_skills(volunteer['id'], project['id'], cursor)
                
                # Store match for batch insert
                matches_to_insert.append({
                    'project_id': project['id'],
                    'volunteer_id': volunteer['id'],
                    'skill_score': float(skill_score),
                    'distance_km': float(distance_km),
                    'combined_score': float(combined_score),
                    'matched_skills': matched_skills
                })
                
                # Insert batch when it reaches batch_size
                if len(matches_to_insert) >= batch_size:
                    insert_matches_batch(cursor, matches_to_insert)
                    total_matches += len(matches_to_insert)
                    matches_to_insert = []
                    logger.info(f"Inserted {total_matches} matches so far...")
        
        # Insert remaining matches
        if matches_to_insert:
            insert_matches_batch(cursor, matches_to_insert)
            total_matches += len(matches_to_insert)
        
        # Update the updated_at timestamp
        cursor.execute("UPDATE project_volunteer_matches SET updated_at = NOW()")
        
        # Commit all changes
        conn.commit()
        logger.info(f"Successfully refreshed {total_matches} matches with tiered matching")
        
        return total_matches
        
    except Exception as e:
        logger.error(f"Error during batch matching: {e}")
        if 'conn' in locals():
            conn.rollback()
        raise
    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'conn' in locals():
            conn.close()

def insert_matches_batch(cursor, matches: List[Dict[str, Any]]) -> None:
    """Insert a batch of matches into the database."""
    if not matches:
        return
    
    # Prepare batch insert query
    query = """
        INSERT INTO project_volunteer_matches 
        (project_id, volunteer_id, skill_score, distance_km, combined_score, matched_skills)
        VALUES (%(project_id)s, %(volunteer_id)s, %(skill_score)s, %(distance_km)s, %(combined_score)s, %(matched_skills)s)
        ON CONFLICT (project_id, volunteer_id) DO UPDATE SET
            skill_score = EXCLUDED.skill_score,
            distance_km = EXCLUDED.distance_km,
            combined_score = EXCLUDED.combined_score,
            matched_skills = EXCLUDED.matched_skills,
            updated_at = NOW()
    """
    
    cursor.executemany(query, matches)

def main():
    """Main function."""
    parser = argparse.ArgumentParser(description='Batch matching for volunteer-project pairs')
    parser.add_argument('--skill-weight', type=float, default=0.7, 
                       help='Weight for skill similarity (default: 0.7)')
    parser.add_argument('--distance-weight', type=float, default=0.3,
                       help='Weight for distance (default: 0.3)')
    parser.add_argument('--max-distance', type=float, default=100,
                       help='Maximum distance in km (default: 100)')
    parser.add_argument('--batch-size', type=int, default=1000,
                       help='Batch size for database inserts (default: 1000)')
    parser.add_argument('--dry-run', action='store_true',
                       help='Run without making changes to database')
    
    args = parser.parse_args()
    
    if args.dry_run:
        logger.info("DRY RUN: No changes will be made to the database")
        return
    
    try:
        start_time = datetime.now()
        total_matches = refresh_matches(
            skill_weight=args.skill_weight,
            distance_weight=args.distance_weight,
            max_distance=args.max_distance,
            batch_size=args.batch_size
        )
        end_time = datetime.now()
        
        duration = end_time - start_time
        logger.info(f"Batch matching completed in {duration}")
        logger.info(f"Total matches processed: {total_matches}")
        
    except Exception as e:
        logger.error(f"Batch matching failed: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()
