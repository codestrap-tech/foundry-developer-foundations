/* JSX */
/* @jsxImportSource preact */
import { useState, useRef, useEffect } from 'preact/hooks';
import { ChevronDown } from 'lucide-react';
import type { ThreadListItem } from '../../lib/backend-types';

interface CustomSelectProps {
  items: ThreadListItem[];
  selectedId?: string;
  onSelect: (id: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  maxHeight?: string;
  size?: 'default' | 'small';
}

export function CustomSelect({
  items,
  selectedId,
  onSelect,
  placeholder = 'Select an item...',
  searchPlaceholder = 'Search...',
  emptyMessage = 'No items found',
  maxHeight = '50vh',
  size = 'default',
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [filteredItems, setFilteredItems] = useState<ThreadListItem[]>(items);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Filter items based on search text
  useEffect(() => {
    if (!searchText.trim()) {
      setFilteredItems(items);
    } else {
      const query = searchText.toLowerCase();
      const filtered = items.filter((item) =>
        (item.label + ' ' + item.worktreeName).toLowerCase().includes(query),
      );
      setFilteredItems(filtered);
    }
  }, [items, searchText]);

  // Update filtered items when items change
  useEffect(() => {
    setFilteredItems(items);
  }, [items]);

  const selectedItem = items.find((item) => item.id === selectedId);

  const handleInputClick = () => {
    setIsOpen(true);
    // Focus the input when opening
    setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchText(e.target.value);
    if (!isOpen) {
      setIsOpen(true);
    }
  };

  const handleItemSelect = (item: ThreadListItem) => {
    onSelect(item.id);
    setIsOpen(false);
    setSearchText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      setSearchText('');
    } else if (e.key === 'Enter' && filteredItems.length === 1) {
      handleItemSelect(filteredItems[0]);
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setSearchText('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Size-specific styles
  const containerWidth = size === 'small' ? '45%' : '100%';
  const dropdownWidth = size === 'small' ? '150%' : '100%';
  const dropdownMaxHeight = size === 'small' ? '35vh' : maxHeight;

  return (
    <div
      ref={containerRef}
      className="position-relative"
      style={{ width: containerWidth }}
    >
      {/* Input field */}
      <div className="mb-1 mt-1 position-relative" style={{ width: '100%' }}>
        <input
          ref={inputRef}
          className={`form-control ${size === 'small' ? 'input-sm' : 'width-full'}`}
          placeholder={isOpen ? searchPlaceholder : placeholder}
          value={
            isOpen ? searchText : selectedItem ? `${selectedItem.label}` : ''
          }
          onClick={handleInputClick}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          readOnly={!isOpen}
        />
        <ChevronDown
          size={size === 'small' ? 14 : 16}
          style={{
            position: 'absolute',
            right: '8px',
            top: '50%',
            transform: 'translateY(-50%)',
            pointerEvents: 'none',
            color: 'var(--vscode-input-foreground)',
          }}
        />
      </div>

      {/* Dropdown list */}
      {isOpen && (
        <div
          className="Box position-absolute custom-select-list"
          style={{
            zIndex: 1000,
            maxHeight: dropdownMaxHeight,
            overflow: 'auto',
            top: '100%',
            left: 0,
            width: dropdownWidth,
          }}
        >
          {filteredItems.length === 0 ? (
            <div className="p-3 color-fg-muted text-center">{emptyMessage}</div>
          ) : (
            <ul className="list-style-none">
              {filteredItems.map((item, index) => (
                <li
                  key={item.id}
                  style={{
                    backgroundColor:
                      selectedId === item.id
                        ? 'var(--vscode-list-hoverBackground)'
                        : 'transparent',
                    borderBottom:
                      index === filteredItems.length - 1
                        ? 'none'
                        : '1px solid var(--borderColor-default)',
                    cursor: 'pointer',
                    marginBottom: '2px',
                    borderRadius: '6px',
                  }}
                  className="d-flex flex-justify-between"
                >
                  <button
                    className="btn-invisible text-left width-full"
                    onClick={() => handleItemSelect(item)}
                  >
                    <div
                      className="text-bold"
                      style={{ fontSize: size === 'small' ? '11px' : '12px' }}
                    >
                      {item.label}
                    </div>
                    {size !== 'small' && (
                      <div style={{ fontSize: '9px' }}>{item.worktreeName}</div>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
