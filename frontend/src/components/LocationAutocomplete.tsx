import { useEffect, useRef, useState } from 'react'

interface LocationSuggestion {
  displayName: string
  lat: number
  lon: number
}

interface LocationAutocompleteProps {
  placeholder?: string
  disabled?: boolean
  inputStyle?: React.CSSProperties
  onSelect: (loc: LocationSuggestion) => void
}

export default function LocationAutocomplete({ placeholder, disabled, inputStyle, onSelect }: LocationAutocompleteProps) {
  const [input, setInput] = useState('')
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
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
      if (input.trim().length < 2) {
        setSuggestions([])
        return
      }

      try {
        const params = new URLSearchParams({
          q: input.trim(),
          format: 'json',
          addressdetails: '0',
          limit: '5',
        })
        const res = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
          headers: {
            'Accept-Language': 'en',
          },
        })
        const data: Array<{ display_name: string; lat: string; lon: string }> = await res.json()
        const mapped = data.map((d) => ({ displayName: d.display_name, lat: parseFloat(d.lat), lon: parseFloat(d.lon) }))
        setSuggestions(mapped)
        setSelectedIndex(-1)
      } catch (e) {
        console.error('Failed to fetch location suggestions', e)
        setSuggestions([])
      }
    }

    const debounce = setTimeout(fetchSuggestions, 250)
    return () => clearTimeout(debounce)
  }, [input])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((prev) => Math.min(prev + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((prev) => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter') {
      if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
        e.preventDefault()
        handleSelect(suggestions[selectedIndex])
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false)
    }
  }

  const handleSelect = (s: LocationSuggestion) => {
    onSelect(s)
    setInput(s.displayName)
    setSuggestions([])
    setShowSuggestions(false)
    inputRef.current?.blur()
  }

  return (
    <div className="autocomplete-wrapper" ref={wrapperRef}>
      <input
        ref={inputRef}
        type="text"
        className="autocomplete-input"
        style={inputStyle}
        value={input}
        onChange={(e) => {
          setInput(e.target.value)
          setShowSuggestions(true)
        }}
        onFocus={() => setShowSuggestions(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder || 'Search for a location...'}
        disabled={!!disabled}
      />

      {showSuggestions && suggestions.length > 0 && (
        <div className="autocomplete-suggestions">
          {suggestions.map((s, index) => (
            <div
              key={`${s.displayName}-${index}`}
              className={`suggestion-item ${index === selectedIndex ? 'selected' : ''}`}
              onClick={() => handleSelect(s)}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              <div className="suggestion-name">{s.displayName}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}


