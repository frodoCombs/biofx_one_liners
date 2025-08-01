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

    search(query, filters = {}) {
        if (!this.loaded) {
            console.warn('Database not loaded yet');
            return [];
        }

        let results = this.snippets;

        if (query && query.trim()) {
            const searchTerm = query.toLowerCase();
            results = results.filter(snippet => 
                snippet.title.toLowerCase().includes(searchTerm) ||
                snippet.description.toLowerCase().includes(searchTerm) ||
                snippet.tags.some(tag => tag.toLowerCase().includes(searchTerm)) ||
                snippet.code.toLowerCase().includes(searchTerm)
            );
        }

        if (filters.category) {
            results = results.filter(snippet => snippet.category === filters.category);
        }
        
        if (filters.language) {
            results = results.filter(snippet => snippet.language === filters.language);
        }
        
        if (filters.difficulty) {
            results = results.filter(snippet => snippet.difficulty === filters.difficulty);
        }

        if (!filters.showPremium) {
            results = results.filter(snippet => !snippet.premium);
        }

        return results;
    }

    getSnippetById(id) {
        // Try exact match first
        let snippet = this.snippets.find(snippet => snippet.id === id);
        
        // If not found, try string comparison (in case of type mismatch)
        if (!snippet) {
            snippet = this.snippets.find(snippet => String(snippet.id) === String(id));
        }
        
        return snippet;
    }

    getCategories() {
        return this.categories;
    }

    getLanguages() {
        return this.languages;
    }

    getByCategory(category) {
        return this.snippets.filter(snippet => snippet.category === category);
    }

    getRandomSnippets(count = 5) {
        const shuffled = [...this.snippets].sort(() => 0.5 - Math.random());
        return shuffled.slice(0, count);
    }
}

// User Management Class
class UserManager {
    constructor() {
        this.user = null;
        this.favorites = new Set();
    }

    setUser(user) {
        this.user = user;
        if (user) {
            this.loadUserFavorites();
        } else {
            this.favorites.clear();
            this.updateFavoritesCount();
            this.updateFavoriteButtons();
        }
    }

    async loadUserFavorites() {
        if (!this.user) return;
        
        try {
            console.log('Loading favorites for user:', this.user.uid);
            // Load favorites from Firestore
            const favoritesQuery = window.query(
                window.collection(window.db, 'favorites'),
                window.where('userId', '==', this.user.uid)
            );
            const querySnapshot = await window.getDocs(favoritesQuery);
            
            this.favorites.clear();
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                // Ensure consistent string storage
                this.favorites.add(String(data.snippetId));
            });
            
            console.log('Loaded favorites:', Array.from(this.favorites));
            this.updateFavoritesCount();
            this.updateFavoriteButtons();
        } catch (error) {
            console.error('Error loading favorites:', error);
        }
    }


    async toggleFavorite(snippetId) {
        if (!this.user) {
            alert('Please sign in to favorite snippets');
            return;
        }

        // Ensure we're storing IDs consistently as strings
        const id = String(snippetId);
        console.log('Toggling favorite for ID:', id);

        try {
            if (this.favorites.has(id)) {
                // Remove from favorites
                this.favorites.delete(id);
                
                // Remove from Firestore
                const favoritesQuery = window.query(
                    window.collection(window.db, 'favorites'),
                    window.where('userId', '==', this.user.uid),
                    window.where('snippetId', '==', id)
                );
                const querySnapshot = await window.getDocs(favoritesQuery);
                querySnapshot.forEach((doc) => {
                    doc.ref.delete();
                });
                
                console.log('Removed favorite:', id);
            } else {
                // Add to favorites
                this.favorites.add(id);
                
                // Add to Firestore
                await window.addDoc(window.collection(window.db, 'favorites'), {
                    userId: this.user.uid,
                    snippetId: id, // Store as consistent type
                    createdAt: window.serverTimestamp()
                });
                
                console.log('Added favorite:', id);
            }

            this.updateFavoritesCount();
            this.updateFavoriteButtons();
        } catch (error) {
            console.error('Error toggling favorite:', error);
            alert('Error updating favorites. Please try again.');
        }
    }

    updateFavoritesCount() {
        const countElement = document.getElementById('favorites-count');
        if (countElement) {
            countElement.textContent = this.favorites.size;
        }
    }

    updateFavoriteButtons() {
        document.querySelectorAll('.favorite-btn').forEach(btn => {
            const snippetId = btn.dataset.snippetId;
            if (this.favorites.has(snippetId)) {
                btn.classList.add('favorited');
                btn.innerHTML = '❤️ Favorited';
            } else {
                btn.classList.remove('favorited');
                btn.innerHTML = '🤍 Favorite';
            }
        });
    }

    isFavorite(snippetId) {
        return this.favorites.has(snippetId);
    }

    getFavorites() {
        return Array.from(this.favorites);
    }
}

// Comments Manager Class
class CommentsManager {
    constructor() {
        this.currentSnippetId = null;
    }

    async showComments(snippetId, snippetTitle) {
        this.currentSnippetId = snippetId;
        
        document.getElementById('modal-snippet-title').textContent = snippetTitle;
        
        // Show modal immediately
        document.getElementById('commentsModal').style.display = 'block';
        
        // Always show comments to everyone, but only allow adding if signed in
        document.getElementById('comments-container').innerHTML = '<p>Loading comments...</p>';
        await this.loadComments();
        
        if (userManager.user) {
            document.getElementById('add-comment-section').style.display = 'block';
            document.getElementById('login-prompt').style.display = 'none';
        } else {
            document.getElementById('add-comment-section').style.display = 'none';
            document.getElementById('login-prompt').style.display = 'block';
        }
    }

    async loadComments() {
        if (!this.currentSnippetId) {
            return;
        }

        try {
            const commentsQuery = window.query(
                window.collection(window.db, 'comments'),
                window.where('snippetId', '==', this.currentSnippetId),
                window.orderBy('createdAt', 'desc')
            );
            
            const querySnapshot = await window.getDocs(commentsQuery);
            const commentsContainer = document.getElementById('comments-container');
            commentsContainer.innerHTML = '';

            if (querySnapshot.empty) {
                commentsContainer.innerHTML = '<p>No comments yet. Be the first to comment!</p>';
                return;
            }

            querySnapshot.forEach((doc) => {
                const comment = doc.data();
                const commentElement = this.createCommentElement(comment);
                commentsContainer.appendChild(commentElement);
            });
        } catch (error) {
            console.error('Error loading comments:', error);
            document.getElementById('comments-container').innerHTML = '<p>Error loading comments. Please try again later.</p>';
        }
    }

    createCommentElement(comment) {
        const div = document.createElement('div');
        div.className = 'comment';
        
        const date = comment.createdAt ? comment.createdAt.toDate().toLocaleDateString() : 'Recently';
        
        div.innerHTML = `
            <div class="comment-author">${comment.authorName}</div>
            <div class="comment-text">${comment.text}</div>
            <div class="comment-date">${date}</div>
        `;
        
        return div;
    }

    async addComment() {
        if (!userManager.user) {
            alert('Please sign in to add comments');
            return;
        }

        const commentText = document.getElementById('comment-text').value.trim();
        if (!commentText) {
            alert('Please enter a comment');
            return;
        }

        try {
            await window.addDoc(window.collection(window.db, 'comments'), {
                snippetId: this.currentSnippetId,
                text: commentText,
                authorId: userManager.user.uid,
                authorName: userManager.user.displayName || userManager.user.email,
                createdAt: window.serverTimestamp()
            });

            document.getElementById('comment-text').value = '';
            await this.loadComments();
        } catch (error) {
            console.error('Error adding comment:', error);
            alert('Error adding comment. Please try again.');
        }
    }

    closeModal() {
        document.getElementById('commentsModal').style.display = 'none';
        this.currentSnippetId = null;
    }
}

// Global instances
const db = new SnippetsDatabase();
const userManager = new UserManager();
const commentsManager = new CommentsManager();

// Authentication Functions
function initializeAuthStateListener() {
    window.onAuthStateChanged(window.auth, (user) => {
        console.log('Auth state changed:', user ? user.email : 'No user');
        userManager.setUser(user);
        updateUI(user);
    });
}

function updateUI(user) {
    const loggedIn = document.getElementById('logged-in');
    const loggedOut = document.getElementById('logged-out');

    if (user) {
        document.getElementById('username').textContent = user.displayName || user.email;
        document.getElementById('user-avatar').src = user.photoURL || '/default-avatar.png';
        loggedIn.style.display = 'flex';
        loggedOut.style.display = 'none';
    } else {
        loggedIn.style.display = 'none';
        loggedOut.style.display = 'flex';
    }
}

async function signInWithGoogle() {
    const provider = new window.GoogleAuthProvider();
    try {
        const result = await window.signInWithPopup(window.auth, provider);
        console.log('Google sign-in successful:', result.user.email);
    } catch (error) {
        console.error('Google sign-in failed:', error);
        alert('Sign-in failed. Please try again.');
    }
}

async function signInWithGitHub() {
    const provider = new window.GithubAuthProvider();
    try {
        const result = await window.signInWithPopup(window.auth, provider);
        console.log('GitHub sign-in successful:', result.user.email);
    } catch (error) {
        console.error('GitHub sign-in failed:', error);
        alert('GitHub sign-in failed. Please try again.');
    }
}

async function signOut() {
    try {
        await window.firebaseSignOut(window.auth);
        console.log('Sign-out successful');
    } catch (error) {
        console.error('Sign-out failed:', error);
    }
}

// App Functions
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

function performSearch() {
    const query = document.getElementById('searchInput').value;
    const filters = {};
    
    filters.showPremium = checkPremiumAccess();
    
    const results = db.search(query, filters);
    displaySnippets(results);
}

function displaySnippets(snippets) {
    const container = document.getElementById('snippetsContainer');
    container.innerHTML = '';
    
    snippets.forEach(snippet => {
        const snippetElement = createSnippetElement(snippet);
        container.appendChild(snippetElement);
    });

    // Update favorite buttons after displaying snippets
    userManager.updateFavoriteButtons();
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
        <div class="snippet-actions">
            <button class="btn favorite-btn" data-snippet-id="${snippet.id}" 
                    onclick="userManager.toggleFavorite('${snippet.id}')">
                🤍 Favorite
            </button>
            <button class="btn" onclick="commentsManager.showComments('${snippet.id}', '${snippet.title.replace(/'/g, '\\')}')">
                💬 Comments
            </button>
            <button class="btn" onclick="copyToClipboard('${snippet.id}')">
                📋 Copy
            </button>
        </div>
    `;
    return div;
}

function showFavorites() {
    if (!userManager.user) {
        alert('Please sign in to view your favorites');
        return;
    }

    const favoriteIds = userManager.getFavorites();
    console.log('Favorite IDs from user manager:', favoriteIds);
    
    if (favoriteIds.length === 0) {
        alert('You haven\'t favorited any snippets yet!');
        return;
    }

    // Debug: Check what snippets are available
    console.log('Available snippets:', db.snippets.map(s => ({ id: s.id, title: s.title })));
    
    const favoriteSnippets = favoriteIds
        .map(id => {
            console.log('Looking for snippet with ID:', id, 'Type:', typeof id);
            const snippet = db.getSnippetById(id);
            console.log('Found snippet:', snippet ? snippet.title : 'NOT FOUND');
            return snippet;
        })
        .filter(snippet => snippet !== undefined);

    console.log('Final favorite snippets:', favoriteSnippets);
    
    if (favoriteSnippets.length === 0) {
        alert('No favorite snippets found. This might be a data type mismatch issue.');
        return;
    }

    displaySnippets(favoriteSnippets);
}

function showAllSnippets() {
    displaySnippets(db.search(''));
}

// Utility functions
function populateFilters() {
    // This function can be expanded later for category/language filters
}

function getPreviewCode(code) {
    const lines = code.split('\n');
    const previewLines = lines.slice(0, 5);
    return previewLines.join('\n') + '\n\n// ... Premium content continues ...';
}

function checkPremiumAccess() {
    // For now, return false. You can implement premium logic later
    return false;
}

async function copyToClipboard(snippetId) {
    const snippet = db.getSnippetById(snippetId);
    if (snippet) {
        try {
            await navigator.clipboard.writeText(snippet.code);
            alert('Code copied to clipboard!');
        } catch (err) {
            console.error('Failed to copy: ', err);
            alert('Failed to copy code');
        }
    }
}

// Modal functions
function closeCommentsModal() {
    commentsManager.closeModal();
}

function addComment() {
    commentsManager.addComment();
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
    
    // Add search event listener
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', performSearch);
    }
});