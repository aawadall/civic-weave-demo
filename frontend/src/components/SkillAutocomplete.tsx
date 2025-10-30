import { useState, useEffect, useRef } from 'react'
import { Skill } from '../types'
import { searchSkills, createSkill } from '../api'

interface SkillAutocompleteProps {
  onSelect: (skill: Skill) => void
  placeholder?: string
}

export default function SkillAutocomplete({ onSelect, placeholder }: SkillAutocompleteProps) {
  const [input, setInput] = useState('')
  const [suggestions, setSuggestions] = useState<Skill[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [creating, setCreating] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowSuggestions(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    const fetchSuggestions = async () => {
      if (input.trim().length < 1) {
        setSuggestions([])
        return
      }

      try {
        const results = await searchSkills(input, 10)
        setSuggestions(Array.isArray(results) ? results : [])
        setSelectedIndex(-1)
      } catch (err) {
        console.error('Failed to search skills:', err)
        setSuggestions([])
      }
    }

    const debounce = setTimeout(fetchSuggestions, 200)
    return () => clearTimeout(debounce)
  }, [input])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value)
    setShowSuggestions(true)
  }

  const handleSelect = (skill: Skill) => {
    onSelect(skill)
    setInput('')
    setSuggestions([])
    setShowSuggestions(false)
    inputRef.current?.focus()
  }

  const handleCreateNew = async () => {
    if (!input.trim()) return

    setCreating(true)
    try {
      const newSkill = await createSkill({ name: input.trim() })
      handleSelect(newSkill)
    } catch (err) {
      console.error('Failed to create skill:', err)
    } finally {
      setCreating(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || suggestions.length === 0) {
      if (e.key === 'Enter' && input.trim()) {
        handleCreateNew()
      }
      return
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex((prev) => Math.min(prev + 1, suggestions.length))
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex((prev) => Math.max(prev - 1, -1))
        break
      case 'Enter':
        e.preventDefault()
        if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
          handleSelect(suggestions[selectedIndex])
        } else if (selectedIndex === suggestions.length) {
          handleCreateNew()
        } else if (input.trim()) {
          handleCreateNew()
        }
        break
      case 'Escape':
        setShowSuggestions(false)
        setSelectedIndex(-1)
        break
    }
  }

  const exactMatch = (suggestions || []).some(
    (s) => s.name.toLowerCase() === input.trim().toLowerCase()
  )

  const showCreateOption = input.trim().length > 0 && !exactMatch

  return (
    <div className="autocomplete-wrapper" ref={wrapperRef}>
      <input
        ref={inputRef}
        type="text"
        className="autocomplete-input"
        value={input}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onFocus={() => setShowSuggestions(true)}
        placeholder={placeholder || 'Search or add new skill...'}
        disabled={creating}
      />

      {showSuggestions && (suggestions.length > 0 || showCreateOption) && (
        <div className="autocomplete-suggestions">
          {suggestions.map((skill, index) => (
            <div
              key={skill.id}
              className={`suggestion-item ${index === selectedIndex ? 'selected' : ''}`}
              onClick={() => handleSelect(skill)}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              <div className="suggestion-name">{skill.name}</div>
              {skill.description && (
                <div className="suggestion-description">{skill.description}</div>
              )}
            </div>
          ))}

          {showCreateOption && (
            <div
              className={`suggestion-item create-new ${
                selectedIndex === suggestions.length ? 'selected' : ''
              }`}
              onClick={handleCreateNew}
              onMouseEnter={() => setSelectedIndex(suggestions.length)}
            >
              <div className="suggestion-name">
                ➕ Create "{input.trim()}"
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
