
import { useEffect, useState } from "react";
import "./App.css";

const API_URL = "http://localhost:5000/api/items";
const SERVER_URL = "http://localhost:5000";

const CATEGORIES = [
  "Electronics",
  "Personal Belongings",
  "Bottles & Tumblers",
  "Bags & Wallets",
  "Documents",
  "Clothing",
  "School Supplies",
  "Accessories",
  "Keys",
  "Jewelry",
  "Other"
];

const ITEM_STATUSES = ["Open", "Matched", "Claimed"];
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp"
];

function getImageSrc(imageUrl) {
  if (!imageUrl) return "";
  if (/^https?:\/\//i.test(imageUrl)) return imageUrl;

  return `${SERVER_URL}/${imageUrl.replace(/^\/+/, "")}`;
}

async function readResponse(response) {
  const text = await response.text();

  let data = {};

  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error("The server returned an invalid response.");
  }

  if (!response.ok) {
    throw new Error(
      data.message || `Request failed (${response.status}).`
    );
  }

  return data;
}

function validateImage(file) {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return "Choose a JPG, PNG, or WebP image.";
  }

  if (file.size > MAX_IMAGE_SIZE) {
    return "The image must be 5 MB or smaller.";
  }

  return "";
}

function App() {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [editingItem, setEditingItem] = useState(null);
  const [actionMessage, setActionMessage] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const [editSelectedImage, setEditSelectedImage] = useState(null);
  const [editImagePreview, setEditImagePreview] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formMessage, setFormMessage] = useState("");

  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState("");

  const [formData, setFormData] = useState({
    itemName: "",
    type: "Lost",
    category: "Electronics",
    description: "",
    location: "",
    date: new Date().toISOString().split("T")[0],
    imageUrl: "",
    contactInfo: ""
  });

  // Load reports from MongoDB through the backend.
  useEffect(() => {
    let cancelled = false;

    async function loadItems() {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(API_URL);
        const data = await readResponse(response);
        const records = Array.isArray(data) ? data : data.items;

        if (!cancelled) {
          setItems(Array.isArray(records) ? records : []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err.message ||
              "Could not connect to the backend. Make sure your server is running."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadItems();

    return () => {
      cancelled = true;
    };
  }, []);

  // Preview the selected photo on the report form.
  useEffect(() => {
    if (!selectedImage) {
      setImagePreview("");
      return undefined;
    }

    const previewUrl = URL.createObjectURL(selectedImage);
    setImagePreview(previewUrl);

    return () => URL.revokeObjectURL(previewUrl);
  }, [selectedImage]);

  // Preview the replacement photo on the edit form.
  useEffect(() => {
    if (!editSelectedImage) {
      setEditImagePreview("");
      return undefined;
    }

    const previewUrl = URL.createObjectURL(editSelectedImage);
    setEditImagePreview(previewUrl);

    return () => URL.revokeObjectURL(previewUrl);
  }, [editSelectedImage]);

  function updateField(field, value) {
    setFormData((previous) => ({
      ...previous,
      [field]: value
    }));
  }

  function handleImageChange(event) {
    const file = event.target.files?.[0];
    setFormMessage("");

    if (!file) return;

    const validationMessage = validateImage(file);

    if (validationMessage) {
      setFormMessage(validationMessage);
      event.target.value = "";
      return;
    }

    setSelectedImage(file);
  }

  function handleEditImageChange(event) {
    const file = event.target.files?.[0];
    setActionMessage("");

    if (!file) return;

    const validationMessage = validateImage(file);

    if (validationMessage) {
      setActionMessage(validationMessage);
      event.target.value = "";
      return;
    }

    setEditSelectedImage(file);
  }

  async function uploadImage(file) {
    const uploadData = new FormData();
    uploadData.append("image", file);

    const response = await fetch(`${API_URL}/upload`, {
      method: "POST",
      body: uploadData
    });

    const data = await readResponse(response);

    if (!data.imageUrl) {
      throw new Error("The server did not return an image URL.");
    }

    return data.imageUrl;
  }

  function resetReportForm() {
    setFormData({
      itemName: "",
      type: "Lost",
      category: "Electronics",
      description: "",
      location: "",
      date: new Date().toISOString().split("T")[0],
      imageUrl: "",
      contactInfo: ""
    });

    setSelectedImage(null);

    const input = document.getElementById("itemImage");
    if (input) input.value = "";
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setFormMessage("");

    try {
      let imageUrl = formData.imageUrl;

      if (selectedImage) {
        imageUrl = await uploadImage(selectedImage);
      }

      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          ...formData,
          imageUrl
        })
      });

      const data = await readResponse(response);
      const newItem = data.item || data;

      if (!newItem._id && !newItem.id) {
        throw new Error(
          "The server did not return an item record. Refresh the page to check whether the report was saved."
        );
      }

      setItems((previous) => [
        newItem,
        ...previous.filter((item) => item._id !== newItem._id)
      ]);

      resetReportForm();
      setShowForm(false);
      setFilter("All");
      setStatusFilter("All");
      setSearch("");
      setFormMessage("Your report was submitted successfully!");
    } catch (err) {
      setFormMessage(
        err.message ||
          "Unable to submit your report. Check your backend server."
      );
    } finally {
      setSubmitting(false);
    }
  }

  const filteredItems = items.filter((item) => {
    const keyword = search.toLowerCase().trim();

    const searchableText = [
      item.itemName,
      item.location,
      item.category,
      item.description
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    const matchesSearch = searchableText.includes(keyword);
    const matchesType = filter === "All" || item.type === filter;
    const matchesStatus =
      statusFilter === "All" ||
      (item.status || "Open") === statusFilter;

    return matchesSearch && matchesType && matchesStatus;
  });

  function getMatchScore(lostItem, foundItem) {
    let score = 0;

    const normalize = (value) =>
      String(value || "").toLowerCase().trim();

    const lostName = normalize(lostItem.itemName);
    const foundName = normalize(foundItem.itemName);

    const lostWords = lostName
      .split(/[^a-z0-9]+/)
      .filter((word) => word.length > 2);

    const foundWords = foundName
      .split(/[^a-z0-9]+/)
      .filter((word) => word.length > 2);

    const commonWords = lostWords.filter((word) =>
      foundWords.includes(word)
    );

    if (lostName && lostName === foundName) {
      score += 3;
    } else if (commonWords.length > 0) {
      score += 2;
    }

    if (
      normalize(lostItem.category) &&
      normalize(lostItem.category) === normalize(foundItem.category)
    ) {
      score += 2;
    }

    const lostLocation = normalize(lostItem.location);
    const foundLocation = normalize(foundItem.location);

    if (
      lostLocation &&
      foundLocation &&
      lostLocation === foundLocation
    ) {
      score += 2;
    } else if (
      lostLocation &&
      foundLocation &&
      (lostLocation.includes(foundLocation) ||
        foundLocation.includes(lostLocation))
    ) {
      score += 1;
    }

    return score;
  }

  const openItems = items.filter(
    (item) => (item.status || "Open") === "Open"
  );

  const possibleMatches = openItems
    .filter((item) => item.type === "Lost")
    .flatMap((lostItem) =>
      openItems
        .filter(
          (item) =>
            item.type === "Found" &&
            item._id !== lostItem._id
        )
        .map((foundItem) => ({
          lostItem,
          foundItem,
          score: getMatchScore(lostItem, foundItem)
        }))
        .filter((match) => match.score >= 3)
    )
    .sort((a, b) => b.score - a.score);

  async function confirmMatch(lostItem, foundItem) {
    if (actionLoading) return;

    const confirmed = window.confirm(
      `Confirm that "${lostItem.itemName}" and "${foundItem.itemName}" are a match? Both reports will be marked Matched.`
    );

    if (!confirmed) return;

    setActionLoading(true);
    setActionMessage("");

    try {
      const response = await fetch(
        `${API_URL}/confirm-match/${lostItem._id}/${foundItem._id}`,
        { method: "PUT" }
      );

      const data = await readResponse(response);
      const updatedItems = data.items || [];

      if (updatedItems.length) {
        setItems((previous) =>
          previous.map((item) => {
            const updated = updatedItems.find(
              (record) => record._id === item._id
            );
            return updated || item;
          })
        );
      } else {
        const refreshResponse = await fetch(API_URL);
        const refreshedData = await readResponse(refreshResponse);
        const records = Array.isArray(refreshedData)
          ? refreshedData
          : refreshedData.items;

        if (Array.isArray(records)) setItems(records);
      }

      setActionMessage(
        data.message || "Match confirmed successfully!"
      );
    } catch (err) {
      setActionMessage(
        err.message || "Could not confirm the match."
      );
    } finally {
      setActionLoading(false);
    }
  }

  const lostCount = items.filter(
    (item) => item.type === "Lost"
  ).length;

  const foundCount = items.filter(
    (item) => item.type === "Found"
  ).length;

  const matchedCount = items.filter(
    (item) => (item.status || "Open") === "Matched"
  ).length;

  function startEditing(item) {
    setEditingItem({
      ...item,
      date: item.date
        ? new Date(item.date).toISOString().split("T")[0]
        : new Date().toISOString().split("T")[0]
    });

    setEditSelectedImage(null);
    setActionMessage("");
    setShowForm(false);

    setTimeout(() => {
      document.getElementById("edit-item")?.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    }, 0);
  }

  function cancelEditing() {
    setEditingItem(null);
    setEditSelectedImage(null);
    setActionMessage("");
  }

  async function saveEdit(event) {
    event.preventDefault();

    if (!editingItem?._id) {
      setActionMessage("This item has no valid database ID.");
      return;
    }

    if (actionLoading) return;

    setActionLoading(true);
    setActionMessage("");

    try {
      let imageUrl = editingItem.imageUrl || "";

      // Upload a new photo only if the user selected one.
      if (editSelectedImage) {
        imageUrl = await uploadImage(editSelectedImage);
      }

      const {
        _id,
        createdAt,
        updatedAt,
        __v,
        ...updates
      } = editingItem;

      const response = await fetch(`${API_URL}/${_id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          ...updates,
          imageUrl
        })
      });

      const data = await readResponse(response);
      const updatedItem = data.item || data;

      setItems((previous) =>
        previous.map((item) =>
          item._id === _id
            ? { ...item, ...updatedItem, imageUrl }
            : item
        )
      );

      setEditingItem(null);
      setEditSelectedImage(null);
      setActionMessage("Item and photo updated successfully!");
    } catch (err) {
      setActionMessage(
        err.message ||
          "Update failed. Check that your backend and image upload endpoint are running."
      );
    } finally {
      setActionLoading(false);
    }
  }

  async function deleteItem(item) {
    if (!item._id) {
      setActionMessage("This item has no valid database ID.");
      return;
    }

    if (actionLoading) return;

    const confirmed = window.confirm(
      `Are you sure you want to delete "${item.itemName}"? This cannot be undone.`
    );

    if (!confirmed) return;

    setActionLoading(true);
    setActionMessage("");

    try {
      const response = await fetch(`${API_URL}/${item._id}`, {
        method: "DELETE"
      });

      const data = await readResponse(response);

      setItems((previous) =>
        previous.filter((record) => record._id !== item._id)
      );

      if (editingItem?._id === item._id) {
        cancelEditing();
      }

      setActionMessage(
        data.message || "Item deleted successfully!"
      );
    } catch (err) {
      setActionMessage(err.message || "Delete failed.");
    } finally {
      setActionLoading(false);
    }
  }

  function renderCategoryOptions() {
    return CATEGORIES.map((category) => (
      <option key={category} value={category}>
        {category}
      </option>
    ));
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">🔎</div>
          <div>
            <h2>CampusFind</h2>
            <p>Lost & Found System</p>
          </div>
        </div>

        <p className="menu-label">MAIN MENU</p>

        <a className="menu-item active" href="#dashboard">
          <span>▦</span> Dashboard
        </a>
        <a className="menu-item" href="#items">
          <span>⌕</span> Browse Items
        </a>
        <a className="menu-item" href="#matches">
          <span>↔</span> Possible Matches
        </a>
        <a
          className="menu-item"
          href="#report"
          onClick={() => setShowForm(true)}
        >
          <span>＋</span> Report an Item
        </a>

        <div className="sidebar-note">
          <span>💡</span>
          <h3>Lost something?</h3>
          <p>
            Search reported items and help reunite belongings
            with their owners.
          </p>
        </div>

        <div className="sidebar-footer">
          <div className="avatar">CF</div>
          <div>
            <strong>Campus Community</strong>
            <small>Student Portal</small>
          </div>
        </div>
      </aside>

      <main className="main-content" id="dashboard">
        <header className="topbar">
          <div>
            <p className="breadcrumb">Campus Portal / Dashboard</p>
            <h1>Lost & Found Dashboard</h1>
          </div>
          <div className="top-status">
            <span className="status-dot"></span>
            Campus Community
          </div>
        </header>

        <section className="welcome-banner">
          <div>
            <p className="eyebrow">WELCOME TO CAMPUSFIND</p>
            <h2>Every item deserves to find its way home.</h2>
            <p>
              Browse lost and found reports around your campus
              and help reconnect people with their belongings.
            </p>
            <a href="#items" className="banner-button">
              Explore Items →
            </a>
          </div>
          <div className="banner-art">🎒</div>
        </section>

        <section className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon blue">▦</div>
            <p>Total Reports</p>
            <h2>{items.length}</h2>
            <small>All reported items</small>
          </div>
          <div className="stat-card">
            <div className="stat-icon orange">⌕</div>
            <p>Lost Items</p>
            <h2>{lostCount}</h2>
            <small>Items reported missing</small>
          </div>
          <div className="stat-card">
            <div className="stat-icon green">✓</div>
            <p>Found Items</p>
            <h2>{foundCount}</h2>
            <small>Items reported found</small>
          </div>
          <div className="stat-card">
            <div className="stat-icon purple">♡</div>
            <p>Matched Items</p>
            <h2>{matchedCount}</h2>
            <small>Potentially reunited</small>
          </div>
        </section>

        <section className="matches-section" id="matches">
          <div className="section-heading">
            <div>
              <h2>Possible Matches</h2>
              <p>
                Suggestions based on item names, categories, and locations.
              </p>
            </div>
            <span className="result-count">
              {possibleMatches.length} suggestions
            </span>
          </div>

          {possibleMatches.length === 0 ? (
            <div className="matches-empty">
              <span>🔎</span>
              <div>
                <h3>No possible matches yet</h3>
                <p>
                  When a Lost report and a Found report have similar
                  details, suggestions will appear here.
                </p>
              </div>
            </div>
          ) : (
            <div className="matches-grid">
              {possibleMatches.map(
                ({ lostItem, foundItem, score }) => (
                  <article
                    className="match-card"
                    key={`${lostItem._id}-${foundItem._id}`}
                  >
                    <div className="match-card-heading">
                      <span className="match-badge">Possible match</span>
                      <span className="match-score">
                        {score >= 6
                          ? "Strong similarity"
                          : "Some similarity"}
                      </span>
                    </div>

                    <div className="match-pair">
                      <div className="match-item lost-match">
                        <small>LOST ITEM</small>
                        <h3>{lostItem.itemName}</h3>
                        <p>{lostItem.category || "Uncategorized"}</p>
                        <p>
                          📍 {lostItem.location || "Location not provided"}
                        </p>
                      </div>
                      <div className="match-arrow">↔</div>
                      <div className="match-item found-match">
                        <small>FOUND ITEM</small>
                        <h3>{foundItem.itemName}</h3>
                        <p>{foundItem.category || "Uncategorized"}</p>
                        <p>
                          📍 {foundItem.location || "Location not provided"}
                        </p>
                      </div>
                    </div>

                    <p className="match-note">
                      Compare the details and contact the reporter to
                      verify. This is only an automated suggestion.
                    </p>

                    <button
                      type="button"
                      className="confirm-match-button"
                      disabled={actionLoading}
                      onClick={() => confirmMatch(lostItem, foundItem)}
                    >
                      {actionLoading
                        ? "Processing..."
                        : "✓ Confirm Match"}
                    </button>
                  </article>
                )
              )}
            </div>
          )}
        </section>

        <section className="report-section" id="report">
          <div className="report-heading">
            <div>
              <h2>Have you lost or found something?</h2>
              <p>
                Submit a report to help reconnect belongings
                with their owners.
              </p>
            </div>
            <button
              type="button"
              className="report-button"
              onClick={() => {
                setShowForm((previous) => !previous);
                setFormMessage("");
              }}
            >
              {showForm ? "Close Form −" : "+ Report an Item"}
            </button>
          </div>

          {formMessage && (
            <p
              className={
                formMessage.includes("successfully")
                  ? "form-message"
                  : "form-message form-error"
              }
              role="status"
            >
              {formMessage}
            </p>
          )}

          {showForm && (
            <form className="report-form" onSubmit={handleSubmit}>
              <div className="form-grid">
                <label>
                  Item Name *
                  <input
                    required
                    value={formData.itemName}
                    onChange={(event) =>
                      updateField("itemName", event.target.value)
                    }
                    placeholder="e.g. Blue water bottle"
                  />
                </label>

                <label>
                  Report Type *
                  <select
                    value={formData.type}
                    onChange={(event) =>
                      updateField("type", event.target.value)
                    }
                  >
                    <option value="Lost">Lost Item</option>
                    <option value="Found">Found Item</option>
                  </select>
                </label>

                <label>
                  Category *
                  <select
                    required
                    value={formData.category}
                    onChange={(event) =>
                      updateField("category", event.target.value)
                    }
                  >
                    {renderCategoryOptions()}
                  </select>
                </label>

                <label>
                  Location *
                  <input
                    required
                    value={formData.location}
                    onChange={(event) =>
                      updateField("location", event.target.value)
                    }
                    placeholder="e.g. Library"
                  />
                </label>

                <label>
                  Date *
                  <input
                    required
                    type="date"
                    value={formData.date}
                    onChange={(event) =>
                      updateField("date", event.target.value)
                    }
                  />
                </label>

                <label>
                  Contact Information
                  <input
                    value={formData.contactInfo}
                    onChange={(event) =>
                      updateField("contactInfo", event.target.value)
                    }
                    placeholder="Email or phone"
                  />
                </label>

                <div className="full-width image-upload-field">
                  <label htmlFor="itemImage">Item Photo (optional)</label>
                  <input
                    id="itemImage"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleImageChange}
                    disabled={submitting}
                  />
                  <small>JPG, PNG, or WebP. Maximum size: 5 MB.</small>

                  {imagePreview && (
                    <div className="image-preview">
                      <img
                        src={imagePreview}
                        alt="Selected item preview"
                      />
                      <button
                        type="button"
                        className="remove-image-button"
                        disabled={submitting}
                        onClick={() => {
                          setSelectedImage(null);
                          const input = document.getElementById("itemImage");
                          if (input) input.value = "";
                        }}
                      >
                        Remove photo
                      </button>
                    </div>
                  )}

                  <p className="image-upload-note">
                    A clear photo can help others identify the item.
                  </p>
                </div>

                <label className="full-width">
                  Description
                  <textarea
                    rows="3"
                    value={formData.description}
                    onChange={(event) =>
                      updateField("description", event.target.value)
                    }
                    placeholder="Describe the item's color, brand, or identifying details..."
                  />
                </label>
              </div>

              <button
                type="submit"
                className="submit-report"
                disabled={submitting}
              >
                {submitting ? "Uploading and submitting..." : "Submit Report"}
              </button>
            </form>
          )}
        </section>

        {editingItem && (
          <section className="report-section edit-section" id="edit-item">
            <div className="report-heading">
              <div>
                <h2>Edit Item Report</h2>
                <p>
                  Update the report details or replace its photo.
                </p>
              </div>
              <button
                type="button"
                className="cancel-edit"
                onClick={cancelEditing}
                disabled={actionLoading}
              >
                Cancel
              </button>
            </div>

            <form className="report-form" onSubmit={saveEdit}>
              <div className="form-grid">
                <label>
                  Item Name *
                  <input
                    required
                    value={editingItem.itemName || ""}
                    onChange={(event) =>
                      setEditingItem({
                        ...editingItem,
                        itemName: event.target.value
                      })
                    }
                  />
                </label>

                <label>
                  Report Type *
                  <select
                    value={editingItem.type || "Lost"}
                    onChange={(event) =>
                      setEditingItem({
                        ...editingItem,
                        type: event.target.value
                      })
                    }
                  >
                    <option value="Lost">Lost Item</option>
                    <option value="Found">Found Item</option>
                  </select>
                </label>

                <label>
                  Category *
                  <select
                    required
                    value={editingItem.category || "Other"}
                    onChange={(event) =>
                      setEditingItem({
                        ...editingItem,
                        category: event.target.value
                      })
                    }
                  >
                    {renderCategoryOptions()}
                  </select>
                </label>

                <label>
                  Location *
                  <input
                    required
                    value={editingItem.location || ""}
                    onChange={(event) =>
                      setEditingItem({
                        ...editingItem,
                        location: event.target.value
                      })
                    }
                  />
                </label>

                <label>
                  Date *
                  <input
                    required
                    type="date"
                    value={editingItem.date || ""}
                    onChange={(event) =>
                      setEditingItem({
                        ...editingItem,
                        date: event.target.value
                      })
                    }
                  />
                </label>

                <label>
                  Status
                  <select
                    value={editingItem.status || "Open"}
                    onChange={(event) =>
                      setEditingItem({
                        ...editingItem,
                        status: event.target.value
                      })
                    }
                  >
                    {ITEM_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Contact Information
                  <input
                    value={editingItem.contactInfo || ""}
                    onChange={(event) =>
                      setEditingItem({
                        ...editingItem,
                        contactInfo: event.target.value
                      })
                    }
                  />
                </label>

                <div className="full-width image-upload-field edit-image-field">
                  <label htmlFor="editItemImage">Replace Item Photo</label>

                  <input
                    id="editItemImage"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleEditImageChange}
                    disabled={actionLoading}
                  />

                  <small>
                    Choose a new JPG, PNG, or WebP photo up to 5 MB.
                    Leave this empty to keep the current photo.
                  </small>

                  {(editImagePreview || editingItem.imageUrl) && (
                    <div className="image-preview edit-image-preview">
                      <img
                        src={
                          editImagePreview ||
                          getImageSrc(editingItem.imageUrl)
                        }
                        alt={
                          editImagePreview
                            ? "New photo preview"
                            : "Current item photo"
                        }
                        onError={(event) => {
                          event.currentTarget.style.display = "none";
                        }}
                      />

                      <div className="edit-image-actions">
                        {editSelectedImage && (
                          <button
                            type="button"
                            className="remove-image-button"
                            disabled={actionLoading}
                            onClick={() => {
                              setEditSelectedImage(null);
                              const input = document.getElementById(
                                "editItemImage"
                              );
                              if (input) input.value = "";
                            }}
                          >
                            Cancel new photo
                          </button>
                        )}

                        {editingItem.imageUrl && (
                          <button
                            type="button"
                            className="remove-image-button"
                            disabled={actionLoading}
                            onClick={() => {
                              setEditingItem({
                                ...editingItem,
                                imageUrl: ""
                              });
                              setEditSelectedImage(null);

                              const input = document.getElementById(
                                "editItemImage"
                              );
                              if (input) input.value = "";
                            }}
                          >
                            Remove photo
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <label className="full-width">
                  Description
                  <textarea
                    rows="3"
                    value={editingItem.description || ""}
                    onChange={(event) =>
                      setEditingItem({
                        ...editingItem,
                        description: event.target.value
                      })
                    }
                  />
                </label>
              </div>

              <button
                type="submit"
                className="submit-report"
                disabled={actionLoading}
              >
                {actionLoading ? "Saving changes..." : "Save Changes"}
              </button>
            </form>
          </section>
        )}

        {actionMessage && (
          <p className="form-message" role="status">
            {actionMessage}
          </p>
        )}

        <section className="items-section" id="items">
          <div className="section-heading">
            <div>
              <h2>Browse Reported Items</h2>
              <p>
                Find an item by name, category, location, or status.
              </p>
            </div>
            <span className="result-count">
              {filteredItems.length} items
            </span>
          </div>

          <div className="search-toolbar">
            <div className="search-box">
              <span>⌕</span>
              <input
                type="text"
                placeholder="Search items or locations..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>

            <div className="filter-buttons">
              {["All", "Lost", "Found"].map((type) => (
                <button
                  type="button"
                  key={type}
                  className={
                    filter === type ? "filter-btn selected" : "filter-btn"
                  }
                  onClick={() => setFilter(type)}
                >
                  {type}
                </button>
              ))}
            </div>

            <div className="status-filter">
              <label htmlFor="statusFilter">Item Status</label>
              <select
                id="statusFilter"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value="All">All Statuses</option>
                {ITEM_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {loading && <p className="message">Loading reported items...</p>}
          {error && <p className="message error">{error}</p>}

          {!loading && !error && filteredItems.length === 0 && (
            <div className="empty-state">
              <span>🔍</span>
              <h3>No items found</h3>
              <p>
                Try a different search or select another type or status filter.
              </p>
            </div>
          )}

          <div className="items-grid">
            {filteredItems.map((item) => (
              <article
                className="item-card"
                key={item._id || item.id}
              >
                <div className="item-card-top">
                  <div className="item-placeholder">
                    {item.imageUrl ? (
                      <img
                        src={getImageSrc(item.imageUrl)}
                        alt={item.itemName || "Reported item"}
                        loading="lazy"
                        onError={(event) => {
                          event.currentTarget.style.display = "none";
                          event.currentTarget.parentElement.classList.add(
                            "image-unavailable"
                          );
                        }}
                      />
                    ) : (
                      <span>📦</span>
                    )}
                  </div>

                  <span
                    className={`item-type ${
                      item.type === "Lost" ? "lost" : "found"
                    }`}
                  >
                    {item.type}
                  </span>
                </div>

                <div className="item-details">
                  <span className="category-label">
                    {item.category || "Uncategorized"}
                  </span>

                  <h3>{item.itemName || "Unnamed item"}</h3>

                  <p className="item-description">
                    {item.description || "No description provided."}
                  </p>

                  <div className="item-meta">
                    <span>
                      📍 {item.location || "Location not provided"}
                    </span>
                    <span>
                      📅{" "}
                      {item.date
                        ? new Date(item.date).toLocaleDateString()
                        : "Date not provided"}
                    </span>
                    {item.contactInfo && (
                      <span>✉️ {item.contactInfo}</span>
                    )}
                  </div>

                  <div className="item-card-footer">
                    <span
                      className={`item-status ${String(
                        item.status || "Open"
                      ).toLowerCase()}`}
                    >
                      {item.status || "Open"}
                    </span>
                    <span className="item-reference">Campus report</span>
                  </div>

                  <div className="item-actions">
                    <button
                      type="button"
                      className="edit-button"
                      onClick={() => startEditing(item)}
                    >
                      ✎ Edit
                    </button>
                    <button
                      type="button"
                      className="delete-button"
                      disabled={actionLoading}
                      onClick={() => deleteItem(item)}
                    >
                      🗑 Delete
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <footer className="page-footer">
          CampusFind · Lost & Found Matching System
        </footer>
      </main>
    </div>
  );
}

export default App;
