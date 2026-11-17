const state = {
  items: [],
  favorites: [],
  loading: false,
  error: "",
  storageError: "",
};

const API_URL = "https://dummyjson.com/posts?limit=0&select=id,title";
const STORAGE_KEY = "web_data_explorer_dummyjson_favorites_v1";

const searchForm = document.querySelector("#search-form");
const searchInput = document.querySelector("#search-input");
const resetBtn = document.querySelector("#reset-btn");
const statusMsg = document.querySelector("#status-msg");
const storageMsg = document.querySelector("#storage-msg");
const resultsGrid = document.querySelector("#results-grid");
const resultsCount = document.querySelector("#results-count");
const favsList = document.querySelector("#favs-list");
const favsCount = document.querySelector("#fav-counter");

function normalizeItems(data) {
  if (!Array.isArray(data)) return [];

  const itemsById = new Map();
  for (const item of data) {
    if (!item || typeof item.title !== "string" || !item.title.trim()) continue;

    const id = typeof item.id === "string" && /^\d+$/.test(item.id)
      ? Number(item.id)
      : item.id;
    if (!Number.isSafeInteger(id) || id < 1 || itemsById.has(id)) continue;

    itemsById.set(id, { id, title: item.title });
  }
  return [...itemsById.values()];
}

function escapeTitle(title) {
  return title.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function itemCard(item, button) {
  return `
    <article class="item-card">
      <div>
        <h3>${escapeTitle(item.title)}</h3>
        <small>ID: #${item.id}</small>
      </div>
      ${button}
    </article>
  `;
}

// Keep the cards and counters in sync with state.
function render() {
  statusMsg.textContent = state.loading ? "Loading posts…" : state.error;
  statusMsg.style.color = state.error ? "#fda4af" : "var(--primary)";
  storageMsg.textContent = state.storageError;
  resultsCount.textContent = `${state.items.length} ${state.items.length === 1 ? "item" : "items"}`;
  favsCount.textContent = `${state.favorites.length} saved`;

  if (state.loading || state.error) {
    resultsGrid.innerHTML = "";
  } else if (state.items.length === 0) {
    resultsGrid.innerHTML = '<p class="empty-state">No matching items found.</p>';
  } else {
    resultsGrid.innerHTML = state.items.map(item => {
      const isSaved = state.favorites.some(favorite => favorite.id === item.id);
      return itemCard(item, `
        <button type="button" class="btn-save" data-id="${item.id}" ${isSaved ? "disabled" : ""}>
          ${isSaved ? "Saved" : "Save"}
        </button>
      `);
    }).join("");
  }

  favsList.innerHTML = state.favorites.length === 0
    ? '<p class="empty-state">No favorites saved yet. Click Save on any item.</p>'
    : state.favorites.map(item => itemCard(item, `
      <button type="button" class="btn-remove" data-id="${item.id}">Remove</button>
    `)).join("");
}

// Only the newest search can update the results.
let latestRequest = 0;

async function fetchItems(query = "") {
  const request = ++latestRequest;
  state.loading = true;
  state.error = "";
  state.items = [];
  render();

  try {
    const response = await fetch(API_URL);
    if (!response.ok) {
      throw new Error(`The server returned HTTP ${response.status}.`);
    }

    const data = await response.json();
    if (!Array.isArray(data?.posts)) throw new Error("The server returned unexpected data.");
    if (request !== latestRequest) return;

    const items = normalizeItems(data.posts);
    const keyword = query.trim().toLowerCase();
    state.items = keyword
      ? items.filter(item => item.title.toLowerCase().includes(keyword)).slice(0, 8)
      : items.slice(0, 6);
  } catch (error) {
    if (request !== latestRequest) return;
    state.error = `Could not load posts. ${error.message} Select Search to retry.`;
  }

  state.loading = false;
  render();
}

function loadFavorites() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    state.favorites = saved ? normalizeItems(JSON.parse(saved)) : [];
  } catch {
    state.favorites = [];
    state.storageError = "Saved favorites could not be loaded.";
  }
}

function saveFavorites() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.favorites));
    state.storageError = "";
  } catch {
    state.storageError = "Favorites could not be saved to this browser.";
  }
}

function addFavorite(id) {
  const item = state.items.find(result => result.id === id);
  if (!item || state.favorites.some(favorite => favorite.id === id)) return;

  state.favorites.push(item);
  saveFavorites();
  render();
}

function removeFavorite(id) {
  state.favorites = state.favorites.filter(item => item.id !== id);
  saveFavorites();
  render();
}

searchForm.addEventListener("submit", event => {
  event.preventDefault();
  fetchItems(searchInput.value);
});

resetBtn.addEventListener("click", () => {
  searchInput.value = "";
  fetchItems();
});

// Listen on the lists because render() recreates the buttons.
resultsGrid.addEventListener("click", event => {
  const button = event.target.closest(".btn-save");
  if (button) addFavorite(Number(button.dataset.id));
});

favsList.addEventListener("click", event => {
  const button = event.target.closest(".btn-remove");
  if (button) removeFavorite(Number(button.dataset.id));
});

loadFavorites();
fetchItems();
