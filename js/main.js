import { 
    API_BASE_URL, 
    DEFAULT_API_KEY, 
    FALLBACK_IMAGE, 
    SECONDARY_FALLBACK_IMAGE 
} from "./api/config.js";

import { fallbackArticles } from "./api/data-seeders.js";

// Selection des elements du DOM
const elements = {
    todayDate: document.querySelector("#todayDate"),
    trendingText: document.querySelector("#trendingText"),
    featuredArticle: document.querySelector("#featuredArticle"),
    topStack: document.querySelector("#topStack"),
    articlesGrid: document.querySelector("#articlesGrid"),
    weeklyList: document.querySelector("#weeklyList"),
    categoryTabs: document.querySelector("#categoryTabs"),
    searchForm: document.querySelector("#searchForm"),
    searchInput: document.querySelector("#searchInput"),
    statusPanel: document.querySelector("#statusPanel"),
    apiKeyForm: document.querySelector("#apiKeyForm"),
    apiKeyInput: document.querySelector("#apiKeyInput"),
    newsletterForm: document.querySelector("#newsletterForm"),
    newsletterMessage: document.querySelector("#newsletterMessage"),
    hamburgerMenu: document.querySelector(".hamburger-menu"),
    mainMenu: document.querySelector("#mainMenu"),
    menuBackdrop: document.querySelector("#menuBackdrop")
};

// État de l'application
const appState = {
    section: "all",
    query: "",
    apiKey: localStorage.getItem("guardianApiKey") || DEFAULT_API_KEY
};

// Formatage de la date en français
function formatDate(dateValue, options = {}) {
    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
        return "";
    }

    return new Intl.DateTimeFormat("fr-FR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        ...options
    }).format(date);
}

// Mise à jour de la date du jour dans l'interface
function setTodayDate() {
    const today = new Date();
    elements.todayDate.textContent = new Intl.DateTimeFormat("fr-FR", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric"
    }).format(today);
}

// Suppression des balises HTML d'une chaîne de caractères
function stripHtml(value = "") {
    const parser = new DOMParser();
    const parsed = parser.parseFromString(value, "text/html");
    return parsed.body.textContent || "";
}

// Normalisation des articles pour l'affichage
function normalizeArticle(article) {
    return {
        title: article.webTitle || article.title || "Titre indisponible",
        section: article.sectionName || article.section || "News",
        date: article.webPublicationDate || article.date || new Date().toISOString(),
        description: stripHtml(article.fields?.trailText || article.description || "Lire la suite de cet article."),
        url: article.webUrl || article.url || "#",
        image: article.fields?.thumbnail || article.image || FALLBACK_IMAGE,
        source: article.fields?.byline || article.source || "The Guardian"
    };
}

// Construction de l'URL de requête pour l'API
function buildRequestUrl() {
    const params = new URLSearchParams({
        "api-key": appState.apiKey,
        "show-fields": "thumbnail,trailText,byline",
        "order-by": "newest",
        "page-size": "12"
    });

    if (appState.section !== "all") {
        params.set("section", appState.section);
    }

    if (appState.query.trim()) {
        params.set("q", appState.query.trim());
    }

    return `${API_BASE_URL}?${params.toString()}`;
}

// Gestion du menu mobile
function setupMobileMenu() {
    if (!elements.hamburgerMenu || !elements.mainMenu) {
        return;
    }

    const closeMenu = () => {
        elements.mainMenu.classList.remove("is-open");
        elements.hamburgerMenu.classList.remove("is-open");
        elements.hamburgerMenu.setAttribute("aria-expanded", "false");
        document.body.style.overflow = "";
    };

    const openMenu = () => {
        elements.mainMenu.classList.add("is-open");
        elements.hamburgerMenu.classList.add("is-open");
        elements.hamburgerMenu.setAttribute("aria-expanded", "true");
        document.body.style.overflow = "hidden";
    };

    elements.hamburgerMenu.addEventListener("click", () => {
        if (elements.mainMenu.classList.contains("is-open")) {
            closeMenu();
        } else {
            openMenu();
        }
    });

    // Close menu when clicking on a link
    elements.mainMenu.querySelectorAll("a").forEach((link) => {
        link.addEventListener("click", closeMenu);
    });

    // Close menu when clicking on backdrop
    if (elements.menuBackdrop) {
        elements.menuBackdrop.addEventListener("click", closeMenu);
    }

    // Close menu on Escape key
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && elements.mainMenu.classList.contains("is-open")) {
            closeMenu();
            elements.hamburgerMenu.focus();
        }
    });
}

// Gestion de l'état de chargement et des erreurs
function showStatus(message, isVisible = true) {
    elements.statusPanel.hidden = !isVisible;
    elements.statusPanel.textContent = message;
}

// Gestion de l'état de chargement des articles
function setLoadingState() {
    showStatus("Chargement des articles...", true);
    elements.featuredArticle.innerHTML = `
        <div class="skeleton image-skeleton"></div>
        <div class="featured-content">
            <span class="category-tag">News</span>
            <h1>Chargement des actualités...</h1>
            <p>Les derniers articles apparaîtront ici dans quelques secondes.</p>
        </div>
    `;

    elements.topStack.innerHTML = createSkeletonCards(2, "mini-card");
    elements.articlesGrid.innerHTML = createSkeletonCards(4, "article-card");
    elements.weeklyList.innerHTML = createSkeletonCards(4, "weekly-item");
}

// Création de cartes squelettes pour l'affichage pendant le chargement
function createSkeletonCards(count, className) {
    return Array.from({ length: count }, () => {
        if (className === "weekly-item") {
            return `
                <article class="weekly-item">
                    <div class="skeleton image-skeleton"></div>
                    <div>
                        <span>News</span>
                        <h4>Chargement...</h4>
                    </div>
                </article>
            `;
        }

        if (className === "mini-card") {
            return `
                <article class="mini-card">
                    <div class="skeleton image-skeleton"></div>
                </article>
            `;
        }

        return `
            <article class="article-card">
                <div class="skeleton image-skeleton"></div>
                <div class="article-body">
                    <span class="category-tag">News</span>
                    <h3>Chargement...</h3>
                    <p>Veuillez patienter.</p>
                </div>
            </article>
        `;
    }).join("");
}

// Chargement des articles depuis l'API ou les données de secours
async function loadNews() {
    setLoadingState();

    try {
        const response = await fetch(buildRequestUrl());

        if (!response.ok) {
            throw new Error("La réponse de l'API n'est pas disponible.");
        }

        const data = await response.json();
        const articles = data.response?.results?.map(normalizeArticle) || [];

        if (!articles.length) {
            throw new Error("Aucun article trouvé pour cette recherche.");
        }

        showStatus("", false);
        renderNews(articles);
    } catch (error) {
        const filteredFallback = filterFallbackArticles();
        showStatus("Mode démo: l'API n'a pas répondu, donc l'application affiche des exemples locaux.", true);
        renderNews(filteredFallback.length ? filteredFallback : fallbackArticles);
    }
}

// Filtrage des articles de secours en fonction de la section et de la requête
function filterFallbackArticles() {
    const query = appState.query.toLowerCase().trim();

    return fallbackArticles.filter((article) => {
        const sectionMatches = appState.section === "all" || article.section.toLowerCase() === appState.section;
        const queryMatches = !query || `${article.title} ${article.description} ${article.section}`.toLowerCase().includes(query);
        return sectionMatches && queryMatches;
    });
}

// Rendu des articles dans l'interface utilisateur
function renderNews(rawArticles) {
    const articles = rawArticles.map(normalizeArticle);
    const [featured, ...rest] = articles;
    const topArticles = rest.slice(0, 2);
    const gridArticles = rest.slice(2, 10);
    const weeklyArticles = articles.slice(0, 5);

    const trendingTitles = articles.slice(0, 5).map((article) => article.title);
    const repeatedTitles = [...trendingTitles, ...trendingTitles].join("  |  ");
    elements.trendingText.innerHTML = `<span class="trending-track">${escapeHtml(repeatedTitles)}</span>`;

    renderFeatured(featured || articles[0]);
    renderTopStack(topArticles.length ? topArticles : articles.slice(1, 3));
    renderArticleGrid(gridArticles.length ? gridArticles : articles.slice(0, 6));
    renderWeeklyList(weeklyArticles);
}

// Rendu de l'article en vedette
function renderFeatured(article) {
    elements.featuredArticle.innerHTML = `
        <img src="${escapeAttribute(article.image)}" alt="${escapeAttribute(article.title)}" loading="lazy" onerror="this.src='${FALLBACK_IMAGE}'">
        <div class="featured-content">
            <span class="category-tag">${escapeHtml(article.section)}</span>
            <h1><a href="${escapeAttribute(article.url)}" target="_blank" rel="noopener">${escapeHtml(article.title)}</a></h1>
            <p>${escapeHtml(article.description)}</p>
            <div class="article-meta">
                <span>${formatDate(article.date)}</span>
                <span>${escapeHtml(article.source)}</span>
            </div>
        </div>
    `;
}

// Rendu de la pile d'articles en haut de la page
function renderTopStack(articles) {
    elements.topStack.innerHTML = articles.map((article) => `
        <article class="mini-card">
            <img src="${escapeAttribute(article.image)}" alt="${escapeAttribute(article.title)}" loading="lazy" onerror="this.src='${SECONDARY_FALLBACK_IMAGE}'">
            <div class="mini-card-content">
                <span class="category-tag">${escapeHtml(article.section)}</span>
                <h3><a href="${escapeAttribute(article.url)}" target="_blank" rel="noopener">${escapeHtml(article.title)}</a></h3>
            </div>
        </article>
    `).join("");
}

// Rendu de la grille d'articles
function renderArticleGrid(articles) {
    elements.articlesGrid.innerHTML = articles.map((article) => `
        <article class="article-card">
            <img src="${escapeAttribute(article.image)}" alt="${escapeAttribute(article.title)}" loading="lazy" onerror="this.src='${FALLBACK_IMAGE}'">
            <div class="article-body">
                <span class="category-tag">${escapeHtml(article.section)}</span>
                <h3><a href="${escapeAttribute(article.url)}" target="_blank" rel="noopener">${escapeHtml(article.title)}</a></h3>
                <p>${escapeHtml(article.description)}</p>
                <div class="article-meta">
                    <span>${formatDate(article.date)}</span>
                    <span>${escapeHtml(article.source)}</span>
                </div>
                <a class="read-link" href="${escapeAttribute(article.url)}" target="_blank" rel="noopener">Lire l'article</a>
            </div>
        </article>
    `).join("");
}

// Rendu de la liste hebdomadaire d'articles
function renderWeeklyList(articles) {
    elements.weeklyList.innerHTML = articles.map((article) => `
        <article class="weekly-item">
            <img src="${escapeAttribute(article.image)}" alt="${escapeAttribute(article.title)}" loading="lazy" onerror="this.src='${SECONDARY_FALLBACK_IMAGE}'">
            <div>
                <span>${escapeHtml(article.section)} · ${formatDate(article.date, { day: "2-digit", month: "short" })}</span>
                <h4><a href="${escapeAttribute(article.url)}" target="_blank" rel="noopener">${escapeHtml(article.title)}</a></h4>
            </div>
        </article>
    `).join("");
}

// Fonctions utilitaires pour échapper les caractères HTML et les attributs
function escapeHtml(value = "") {
    return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

// Échapper les caractères pour les attributs HTML
function escapeAttribute(value = "") {
    return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

// Gestion des événements pour les interactions utilisateur
function handleCategoryClick(event) {
    const button = event.target.closest("button[data-section]");

    if (!button) {
        return;
    }

    elements.categoryTabs.querySelectorAll("button").forEach((tab) => tab.classList.remove("active"));
    button.classList.add("active");
    appState.section = button.dataset.section;
    loadNews();
}

// Gestion de la recherche d'articles
function handleSearch(event) {
    event.preventDefault();
    appState.query = elements.searchInput.value;
    loadNews();
}

// Gestion de la sauvegarde de la clé API
function handleApiKeySave(event) {
    event.preventDefault();
    const key = elements.apiKeyInput.value.trim() || DEFAULT_API_KEY;
    appState.apiKey = key;
    localStorage.setItem("guardianApiKey", key);
    loadNews();
}

// Gestion de l'inscription à la newsletter
function handleNewsletter(event) {
    event.preventDefault();
    elements.newsletterMessage.textContent = "Merci, votre inscription démo est enregistrée localement.";
    elements.newsletterForm.reset();
}

// Initialisation de l'application
function init() {
    setupMobileMenu();
    setTodayDate();
    elements.apiKeyInput.value = appState.apiKey;
    elements.categoryTabs.addEventListener("click", handleCategoryClick);
    elements.searchForm.addEventListener("submit", handleSearch);
    elements.apiKeyForm.addEventListener("submit", handleApiKeySave);
    elements.newsletterForm.addEventListener("submit", handleNewsletter);
    loadNews();
}

init();
