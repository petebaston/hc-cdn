(() => {
  class ZendeskHelpCenter extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: "open" });
      // Store navigation history
      this.navigationHistory = {
        category: null,
        section: null
      };
    }

    connectedCallback() {
      const template = document.createElement('template');
      template.innerHTML = `
        <div class="zendesk-help-center">
          <style>
            /* Base styles */
            .container { width: 100%; max-width: 1200px; margin: 0 auto; padding: 1rem; }
            .search-container { margin-bottom: 2rem; }
            .search-input { 
              width: 100%;
              padding: 0.75rem;
              border: 1px solid #e2e8f0;
              border-radius: 0.375rem;
              margin-bottom: 0.5rem;
            }
            .results-container {
              background: white;
              border: 1px solid #e2e8f0;
              border-radius: 0.375rem;
              box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
              display: none;
              position: absolute;
              width: calc(100% - 2rem);
              z-index: 10;
            }
            .results-container.active { display: block; }
            .result-item {
              padding: 0.75rem;
              border-bottom: 1px solid #e2e8f0;
              cursor: pointer;
            }
            .result-item:hover { background-color: #f7fafc; }

            /* Enhanced breadcrumb styles */
            .breadcrumb {
              display: flex;
              align-items: center;
              margin-bottom: 1rem;
              font-size: 0.875rem;
            }
            .breadcrumb-item { 
              color: #3182ce;
              cursor: pointer;
            }
            .breadcrumb-item:hover {
              text-decoration: underline;
            }
            .breadcrumb-item.current {
              color: #4a5568;
              cursor: default;
            }
            .breadcrumb-item.current:hover {
              text-decoration: none;
            }
            .breadcrumb-separator { margin: 0 0.5rem; color: #cbd5e0; }

            /* Enhanced section styles */
            .category-title { font-size: 1.5rem; font-weight: 600; margin-bottom: 1rem; }
            .section-list { list-style: none; padding: 0; }
            .section-item { 
              padding: 1rem;
              border: 1px solid #e2e8f0;
              border-radius: 0.375rem;
              margin-bottom: 0.5rem;
              cursor: pointer;
              transition: all 0.2s ease;
              position: relative;
            }
            .section-item:hover {
              border-color: #3182ce;
              background-color: #f7fafc;
              transform: translateY(-1px);
              box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
            }
            .section-item::after {
              content: "→";
              position: absolute;
              right: 1rem;
              top: 50%;
              transform: translateY(-50%);
              color: #3182ce;
              opacity: 0;
              transition: opacity 0.2s ease;
            }
            .section-item:hover::after {
              opacity: 1;
            }
            .section-item h3 {
              margin: 0 0 0.5rem 0;
              color: #2d3748;
            }
            .section-item p {
              margin: 0;
              color: #718096;
              font-size: 0.875rem;
            }

            /* Article styles */
            .article-list { list-style: none; padding: 0; }
            .article-item {
              padding: 0.75rem;
              border-bottom: 1px solid #e2e8f0;
            }
            .article-link {
              color: #3182ce;
              text-decoration: none;
              display: block;
              padding: 0.5rem;
              transition: all 0.2s ease;
            }
            .article-link:hover { 
              text-decoration: underline;
              background-color: #f7fafc;
              border-radius: 0.375rem;
            }
            .back-button {
              display: inline-flex;
              align-items: center;
              color: #3182ce;
              text-decoration: none;
              margin-bottom: 1rem;
              padding: 0.5rem;
              border-radius: 0.375rem;
              transition: all 0.2s ease;
            }
            .back-button:hover { 
              text-decoration: underline;
              background-color: #f7fafc;
            }
            .article-content {
              line-height: 1.6;
              color: #2d3748;
            }
          </style>
          <div class="container">
            <div class="search-container">
              <input type="text" class="search-input" placeholder="Search for articles..." />
              <div class="results-container"></div>
            </div>
            <div class="content"></div>
          </div>
        </div>
      `;

      this.shadowRoot.appendChild(template.content.cloneNode(true));
      this.renderHome();
      this.setupEventListeners();
    }

    async fetchAPI(endpoint, isSearch = false) {
      const subdomain = this.getAttribute("subdomain");
      const locale = this.getAttribute("locale") || "en-us";
      try {
        const baseUrl = `https://${subdomain}.zendesk.com/api/v2/help_center`;
        const url = isSearch 
          ? `${baseUrl}/articles/search${endpoint}`
          : `${baseUrl}/${locale}/${endpoint}`;

        const response = await fetch(url, {
          headers: { 'Accept': 'application/json' }
        });

        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return await response.json();
      } catch (error) {
        console.error(`API Error: ${error.message}`);
        throw error;
      }
    }

    async renderHome() {
      try {
        const { categories } = await this.fetchAPI("categories.json");
        const content = this.shadowRoot.querySelector('.content');

        const categoriesHtml = await Promise.all(categories.map(async category => {
          const { sections } = await this.fetchAPI(`categories/${category.id}/sections.json`);
          return `
            <div class="category">
              <h2 class="category-title">${category.name}</h2>
              <div class="section-list">
                ${sections.map(section => `
                  <div class="section-item" data-section-id="${section.id}" data-category-id="${category.id}" data-category-name="${category.name}">
                    <h3>${section.name}</h3>
                    <p>${section.description || ''}</p>
                  </div>
                `).join('')}
              </div>
            </div>
          `;
        }));

        content.innerHTML = categoriesHtml.join('');
      } catch (error) {
        this.renderError("Failed to load help center categories");
      }
    }

    async renderSection(sectionId, categoryName) {
      try {
        const { section } = await this.fetchAPI(`sections/${sectionId}.json`);
        const { articles } = await this.fetchAPI(`sections/${sectionId}/articles.json`);

        const content = this.shadowRoot.querySelector('.content');
        content.innerHTML = `
          <a href="#" class="back-button" data-action="home">← Back to Categories</a>
          <div class="breadcrumb">
            <span class="breadcrumb-item" data-action="home">Categories</span>
            <span class="breadcrumb-separator">/</span>
            <span class="breadcrumb-item current">${categoryName}</span>
            <span class="breadcrumb-separator">/</span>
            <span class="breadcrumb-item current">${section.name}</span>
          </div>
          <h2 class="category-title">${section.name}</h2>
          <div class="article-list">
            ${articles.map(article => `
              <div class="article-item">
                <a href="#" class="article-link" data-article-id="${article.id}" data-section-id="${sectionId}" data-section-name="${section.name}" data-category-name="${categoryName}">
                  ${article.title}
                </a>
              </div>
            `).join('')}
          </div>
        `;
      } catch (error) {
        this.renderError("Failed to load section");
      }
    }

    async renderArticle(articleId, sectionId, sectionName, categoryName) {
      try {
        const { article } = await this.fetchAPI(`articles/${articleId}.json`);

        const content = this.shadowRoot.querySelector('.content');
        content.innerHTML = `
          <a href="#" class="back-button" data-section-id="${sectionId}">← Back to Section</a>
          <div class="breadcrumb">
            <span class="breadcrumb-item" data-action="home">Categories</span>
            <span class="breadcrumb-separator">/</span>
            <span class="breadcrumb-item" data-section-id="${sectionId}">${categoryName}</span>
            <span class="breadcrumb-separator">/</span>
            <span class="breadcrumb-item" data-section-id="${sectionId}">${sectionName}</span>
            <span class="breadcrumb-separator">/</span>
            <span class="breadcrumb-item current">${article.title}</span>
          </div>
          <h1 class="category-title">${article.title}</h1>
          <div class="article-content">${article.body}</div>
        `;
      } catch (error) {
        this.renderError("Failed to load article");
      }
    }

    renderError(message) {
      const content = this.shadowRoot.querySelector('.content');
      content.innerHTML = `
        <div style="color: #e53e3e; padding: 1rem; text-align: center;">
          ${message}. Please try again later.
        </div>
      `;
    }

    setupEventListeners() {
      const searchInput = this.shadowRoot.querySelector('.search-input');
      const resultsContainer = this.shadowRoot.querySelector('.results-container');
      const content = this.shadowRoot.querySelector('.content');

      // Debounce search
      let searchTimeout;
      searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => this.handleSearch(searchInput.value), 300);
      });

      // Click handlers
      content.addEventListener('click', (e) => {
        e.preventDefault();
        const sectionItem = e.target.closest('.section-item');
        const articleLink = e.target.closest('.article-link');
        const backButton = e.target.closest('.back-button');
        const breadcrumbItem = e.target.closest('.breadcrumb-item:not(.current)');

        if (sectionItem) {
          const sectionId = sectionItem.dataset.sectionId;
          const categoryName = sectionItem.dataset.categoryName;
          this.renderSection(sectionId, categoryName);
        } else if (articleLink) {
          const { articleId, sectionId, sectionName, categoryName } = articleLink.dataset;
          this.renderArticle(articleId, sectionId, sectionName, categoryName);
        } else if (backButton) {
          if (backButton.dataset.sectionId) {
            const sectionId = backButton.dataset.sectionId;
            const categoryName = this.navigationHistory.category;
            this.renderSection(sectionId, categoryName);
          } else {
            this.renderHome();
          }
        } else if (breadcrumbItem) {
          if (breadcrumbItem.dataset.action === 'home') {
            this.renderHome();
          } else if (breadcrumbItem.dataset.sectionId) {
            const sectionId = breadcrumbItem.dataset.sectionId;
            const categoryName = this.navigationHistory.category;
            this.renderSection(sectionId, categoryName);
          }
        }
      });

      // Search results click handler
      resultsContainer.addEventListener('click', (e) => {
        const resultItem = e.target.closest('.result-item');
        if (resultItem) {
          const articleId = resultItem.dataset.articleId;
          this.renderArticle(articleId);
          resultsContainer.classList.remove('active');
          searchInput.value = '';
        }
      });
    }

    async handleSearch(query) {
      const resultsContainer = this.shadowRoot.querySelector('.results-container');

      if (query.length < 3) {
        resultsContainer.classList.remove('active');
        return;
      }

      try {
        const { results } = await this.fetchAPI(`?query=${encodeURIComponent(query)}`, true);

        if (results && results.length > 0) {
          resultsContainer.innerHTML = results
            .slice(0, 5)
            .map(result => `
              <div class="result-item" data-article-id="${result.id}">
                ${result.title}
              </div>
            `).join('');
          resultsContainer.classList.add('active');
        } else {
          resultsContainer.innerHTML = '<div class="result-item">No results found</div>';
          resultsContainer.classList.add('active');
        }
      } catch (error) {
        resultsContainer.innerHTML = '<div class="result-item">Error searching articles</div>';
        resultsContainer.classList.add('active');
      }
    }
  }

  customElements.define("zendesk-help-center", ZendeskHelpCenter);
})();
