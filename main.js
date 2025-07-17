// Database handling functions
class SnippetsDatabase {
    constructor() {
        this.snippets = [];
        this.categories = [];
        this.languages = [];
        this.loaded = false;
    }

    async loadDatabase() {
        console.log('Loading snippets database...');
        try {
            const response = await fetch('snippets-database.json');
            const data = await response.json();
            this.snippets = data.snippets;
            this.categories = data.categories;
            this.languages = data.languages;
            this.loaded = true;
            return true;
        } catch (error) {
            console.error('Failed to load database:', error);
            return false;
        }
    }

    // Search snippets by query
    search(query, filters = {}) {
        if (!this.loaded) {
            console.warn('Database not loaded yet');
            return [];
        }

        let results = this.snippets;

        // Apply text search
        if (query && query.trim()) {
            const searchTerm = query.toLowerCase();
            results = results.filter(snippet => 
                snippet.title.toLowerCase().includes(searchTerm) ||
                snippet.description.toLowerCase().includes(searchTerm) ||
                snippet.tags.some(tag => tag.toLowerCase().includes(searchTerm)) ||
                snippet.code.toLowerCase().includes(searchTerm)
            );
        }

        // Apply filters
        if (filters.category) {
            results = results.filter(snippet => snippet.category === filters.category);
        }
        
        if (filters.language) {
            results = results.filter(snippet => snippet.language === filters.language);
        }
        
        if (filters.difficulty) {
            results = results.filter(snippet => snippet.difficulty === filters.difficulty);
        }

        // Filter premium content if user is not authenticated/hasn't purchased
        if (!filters.showPremium) {
            results = results.filter(snippet => !snippet.premium);
        }

        return results;
    }

    // Get snippet by ID
    getSnippetById(id) {
        return this.snippets.find(snippet => snippet.id === id);
    }

    // Get all categories
    getCategories() {
        return this.categories;
    }

    // Get all languages
    getLanguages() {
        return this.languages;
    }

    // Get snippets by category
    getByCategory(category) {
        return this.snippets.filter(snippet => snippet.category === category);
    }

    // Get random snippets
    getRandomSnippets(count = 5) {
        const shuffled = [...this.snippets].sort(() => 0.5 - Math.random());
        return shuffled.slice(0, count);
    }
}

// Usage example
const db = new SnippetsDatabase();

// Initialize database
async function initializeApp() {
    const loaded = await db.loadDatabase();
    if (loaded) {
        console.log('Database loaded successfully');
        displaySnippets(db.search(''));
        populateFilters();
    } else {
        console.error('Failed to load database');
    }
}

// Search functionality
function performSearch() {
    const query = document.getElementById('searchInput').value;
    const category = document.getElementById('categoryFilter').value;
    const language = document.getElementById('languageFilter').value;
    const difficulty = document.getElementById('difficultyFilter').value;
    
    const filters = {};
    if (category) filters.category = category;
    if (language) filters.language = language;
    if (difficulty) filters.difficulty = difficulty;
    
    // Check if user has premium access (implement your auth logic here)
    filters.showPremium = checkPremiumAccess();
    
    const results = db.search(query, filters);
    displaySnippets(results);
}

// Display snippets in the UI
function displaySnippets(snippets) {
    const container = document.getElementById('snippetsContainer');
    container.innerHTML = '';
    
    snippets.forEach(snippet => {
        const snippetElement = createSnippetElement(snippet);
        container.appendChild(snippetElement);
    });
}

function createSnippetElement(snippet) {
    const div = document.createElement('div');
    div.className = 'snippet-card';
    div.innerHTML = `
        <div class="snippet-header">
            <h3>${snippet.title}</h3>
            <span class="language-badge">${snippet.language}</span>
            ${snippet.premium ? '<span class="premium-badge">Premium</span>' : ''}
        </div>
        <p class="snippet-description">${snippet.description}</p>
        <div class="snippet-tags">
            ${snippet.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
        </div>
        <div class="snippet-code">
            <pre><code>${snippet.premium && !checkPremiumAccess() ? 
                getPreviewCode(snippet.code) : snippet.code}</code></pre>
        </div>
        <div class="output-container" id="output-${snippet.id}">
            <div class="output-content">${snippet.example_output || 'No example output available'}</div>
        </div>
        <div class="snippet-actions">
            <button class="action-btn toggle-output-btn" 
                    data-snippet-id="${snippet.id}" 
                    onclick="toggleOutput(${snippet.id})">
                Show Output
            </button>
            <button class="action-btn toggle-output-btn" onclick="toggleFavorite(${snippet.id})">
                ❤️ Favorite
            </button>
        </div>
        <div class="snippet-footer">
            <button onclick="copyToClipboard('${snippet.id}')">Copy</button>
            <button onclick="toggleFavorite('${snippet.id}')">♥ Favorite</button>
        </div>
    `;
    return div;
}

// Utility functions
function populateFilters() {
    populateSelect('categoryFilter', db.getCategories());
    populateSelect('languageFilter', db.getLanguages());
    populateSelect('difficultyFilter', ['beginner', 'intermediate', 'advanced']);
}

function populateSelect(selectId, options) {
    const select = document.getElementById(selectId);
    select.innerHTML = '<option value="">All</option>';
    options.forEach(option => {
        const optionElement = document.createElement('option');
        optionElement.value = option;
        optionElement.textContent = option.charAt(0).toUpperCase() + option.slice(1);
        select.appendChild(optionElement);
    });
}

function getPreviewCode(code) {
    // Show only first few lines for premium content
    const lines = code.split('\n');
    const previewLines = lines.slice(0, 5);
    return previewLines.join('\n') + '\n\n// ... Premium content continues ...';
}

function checkPremiumAccess() {
    // Implement your authentication/purchase check logic here
    return localStorage.getItem('premiumAccess') === 'true';
}

function toggleOutput(snippetId) {
    const outputContainer = document.getElementById(`output-${snippetId}`);
    const toggleBtn = document.querySelector(`[data-snippet-id="${snippetId}"]`);
    
    if (outputContainer.classList.contains('show')) {
        outputContainer.classList.remove('show');
        toggleBtn.textContent = 'Show Output';
    } else {
        outputContainer.classList.add('show');
        toggleBtn.textContent = 'Hide Output';
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', initializeApp);