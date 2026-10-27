import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "./App.css";
import Chatbot from "./Chatbot";
import Navbar from "./pages/Navbar";

const API_URL = "http://localhost:5000/api/items";
const SERVER_URL = "http://localhost:5000";
const AUTH_URL = "http://localhost:5000/api/auth";

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
  "Other",
];

const ITEM_STATUSES = ["Open", "Matched", "Claimed"];
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

const STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "from",
  "this",
  "that",
  "item",
  "lost",
  "found",
  "have",
  "has",
  "was",
  "were",
  "are",
  "near",
  "some",
  "small",
  "large",
  "very",
  "into",
  "your",
  "mine",
]);

function getImageSrc(imageUrl) {
  if (!imageUrl) return "";

  if (/^https?:\/\//i.test(imageUrl)) {
    return imageUrl;
  }

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
      data.message ||
        data.error ||
        `Request failed (${response.status}).`
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

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function getWords(value) {
  return normalize(value)
    .split(/\s+/)
    .filter(
      (word) => word.length > 2 && !STOP_WORDS.has(word)
    );
}

function getMatchDetails(lostItem, foundItem) {
  let score = 0;
  const reasons = [];

  const lostName = normalize(lostItem.itemName);
  const foundName = normalize(foundItem.itemName);

  const lostWords = new Set(getWords(lostItem.itemName));
  const foundWords = new Set(getWords(foundItem.itemName));

  const sharedNameWords = [...lostWords].filter((word) =>
    foundWords.has(word)
  );

  if (lostName && lostName === foundName) {
    score += 5;
    reasons.push("Item names match");
  } else if (sharedNameWords.length > 0) {
    score += Math.min(4, sharedNameWords.length * 2);

    reasons.push(
      `Shared name detail${
        sharedNameWords.length > 1 ? "s" : ""
      }: ${sharedNameWords.join(", ")}`
    );
  }

  const lostCategory = normalize(lostItem.category);
  const foundCategory = normalize(foundItem.category);

  if (
    lostCategory &&
    foundCategory &&
    lostCategory === foundCategory
  ) {
    score += 3;
    reasons.push("Same category");
  }

  const lostLocation = normalize(lostItem.location);
  const foundLocation = normalize(foundItem.location);

  if (lostLocation && foundLocation) {
    if (lostLocation === foundLocation) {
      score += 3;
      reasons.push("Same location");
    } else {
      const lostLocationWords = new Set(getWords(lostLocation));
      const foundLocationWords = new Set(getWords(foundLocation));

      const sharedLocations = [...lostLocationWords].filter(
        (word) => foundLocationWords.has(word)
      );

      if (
        lostLocation.includes(foundLocation) ||
        foundLocation.includes(lostLocation) ||
        sharedLocations.length > 0
      ) {
        score += 1;
        reasons.push("Similar location");
      }
    }
  }

  const lostDescriptionWords = new Set(
    getWords(lostItem.description)
  );

  const foundDescriptionWords = new Set(
    getWords(foundItem.description)
  );

  const sharedDescriptionWords = [
    ...lostDescriptionWords,
  ].filter((word) => foundDescriptionWords.has(word));

  if (sharedDescriptionWords.length > 0) {
    score += Math.min(3, sharedDescriptionWords.length);
    reasons.push("Similar description details");
  }

  // This is a ranking score, not a probability.
  const maxScore = 14;
  const percentage = Math.min(
    99,
    Math.round((score / maxScore) * 100)
  );

  return { score, percentage, reasons };
}

function App({ user, isAdmin = false }) {
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = location.pathname;

  const pageTitles = {
    "/": "Lost & Found Dashboard",
    "/browse": "Browse Items",
    "/matches": "Possible Matches",
    "/report": "Report an Item",
    "/assistant": "AI Assistant",
    "/history": "Claim History",
    "/students": "Registered Students",
  };

  const currentTitle = pageTitles[currentPath] || pageTitles["/"];

  const [items, setItems] = useState([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [editingItem, setEditingItem] = useState(null);
  const [actionMessage, setActionMessage] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [claimingItemId, setClaimingItemId] = useState(null);
  const [claimText, setClaimText] = useState("");
  const [historyOpenId, setHistoryOpenId] = useState(null);

  const [claimHistory, setClaimHistory] = useState([]);
  const [students, setStudents] = useState([]);
  const [studentSearch, setStudentSearch] = useState("");

  const [editSelectedImage, setEditSelectedImage] = useState(null);
  const [editImagePreview, setEditImagePreview] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formMessage, setFormMessage] = useState("");
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState("");

  const [matchFilter, setMatchFilter] = useState("All");
  const [minimumMatchScore, setMinimumMatchScore] = useState("3");

  const [formData, setFormData] = useState({
    itemName: "",
    type: "Lost",
    category: "Electronics",
    description: "",
    location: "",
    date: new Date().toISOString().split("T")[0],
    imageUrl: "",
    contactInfo: "",
  });

  // IMPORTANT:
  // When the app is loaded or refreshed directly on a subpage,
  // redirect to the Dashboard. Normal in-app navigation is unaffected.
  useEffect(() => {
    if (window.performance?.getEntriesByType) {
      const navigationEntries =
        window.performance.getEntriesByType("navigation");

      const navigationType = navigationEntries[0]?.type;

      if (
        location.pathname !== "/" &&
        (navigationType === "reload" ||
          navigationType === "navigate")
      ) {
        navigate("/", { replace: true });
      }
    }
    // Run only when the app first mounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load reported items from the backend.
  async function loadItems(showLoading = true) {
    try {
      if (showLoading) setLoading(true);

      setError("");

      const response = await fetch(API_URL, {
        method: "GET",
        credentials: "include",
      });

      const data = await readResponse(response);
      const records = Array.isArray(data) ? data : data.items;

      setItems(Array.isArray(records) ? records : []);
    } catch (err) {
      setError(
        err.message ||
          "Could not connect to the backend. Make sure your server is running."
      );
    } finally {
      if (showLoading) setLoading(false);
    }
  }

  // Load the claim history (admin only).
  async function loadHistory() {
    try {
      const response = await fetch(`${API_URL}/claims/history`, {
        credentials: "include",
      });

      const data = await readResponse(response);

      setClaimHistory(Array.isArray(data) ? data : []);
    } catch (err) {
      setActionMessage(
        err.message || "Could not load claim history."
      );
    }
  }

  // Admin: load every registered student.
  async function loadStudents() {
    try {
      const response = await fetch(`${AUTH_URL}/students`, {
        credentials: "include",
      });

      const data = await readResponse(response);

      setStudents(Array.isArray(data.students) ? data.students : []);
    } catch (err) {
      setActionMessage(
        err.message || "Could not load the student list."
      );
    }
  }

  // Admin: set a new password for a student.
  async function resetStudentPassword(student) {
    const newPassword = window.prompt(
      `Type a new password for ${student.fullName} (8 to 72 characters):`
    );

    if (newPassword === null) return;

    if (newPassword.length < 8 || newPassword.length > 72) {
      setActionMessage(
        "The password must be between 8 and 72 characters."
      );
      return;
    }

    try {
      const response = await fetch(
        `${AUTH_URL}/${student.id}/password`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ newPassword }),
        }
      );

      const data = await readResponse(response);

      setActionMessage(data.message || "Password updated.");
    } catch (err) {
      setActionMessage(
        err.message || "Could not update the password."
      );
    }
  }

  // Load items when the application starts.
  useEffect(() => {
    let cancelled = false;

    async function initialLoad() {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(API_URL, {
          method: "GET",
          credentials: "include",
        });

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
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    initialLoad();

    return () => {
      cancelled = true;
    };
  }, []);

  // Load the student list each time the Students page is opened.
  useEffect(() => {
    if (currentPath === "/students" && isAdmin) {
      loadStudents();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPath, isAdmin]);

  // Load the history each time the History page is opened.
  useEffect(() => {
    if (currentPath === "/history") {
      loadHistory();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPath]);

  function updateField(field, value) {
    setFormData((previous) => ({
      ...previous,
      [field]: value,
    }));
  }

  // Handle selecting an image for a new report.
  function handleImageChange(event) {
    const file = event.target.files?.[0];

    setFormMessage("");

    if (!file) {
      setSelectedImage(null);
      setImagePreview("");
      return;
    }

    const message = validateImage(file);

    if (message) {
      setFormMessage(message);
      setSelectedImage(null);
      setImagePreview("");
      event.target.value = "";
      return;
    }

    setSelectedImage(file);

    const reader = new FileReader();

    reader.onload = () => {
      setImagePreview(
        typeof reader.result === "string" ? reader.result : ""
      );
    };

    reader.onerror = () => {
      setImagePreview("");
      setFormMessage(
        "The image could not be previewed. Please choose another image."
      );
    };

    reader.readAsDataURL(file);
  }

  // Handle selecting a replacement image.
  function handleEditImageChange(event) {
    const file = event.target.files?.[0];

    setActionMessage("");

    if (!file) {
      setEditSelectedImage(null);
      setEditImagePreview("");
      return;
    }

    const message = validateImage(file);

    if (message) {
      setActionMessage(message);
      setEditSelectedImage(null);
      setEditImagePreview("");
      event.target.value = "";
      return;
    }

    setEditSelectedImage(file);

    const reader = new FileReader();

    reader.onload = () => {
      setEditImagePreview(
        typeof reader.result === "string" ? reader.result : ""
      );
    };

    reader.onerror = () => {
      setEditImagePreview("");
      setActionMessage(
        "The image could not be previewed. Please choose another image."
      );
    };

    reader.readAsDataURL(file);
  }

  // Upload an image to the backend.
  async function uploadImage(file) {
    const uploadData = new FormData();

    uploadData.append("image", file);

    const response = await fetch(`${API_URL}/upload`, {
      method: "POST",
      credentials: "include",
      body: uploadData,
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
      contactInfo: "",
    });

    setSelectedImage(null);
    setImagePreview("");

    const input = document.getElementById("itemImage");

    if (input) {
      input.value = "";
    }
  }

  // Submit a new lost or found report.
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
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...formData,
          imageUrl,
        }),
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
        ...previous.filter(
          (item) => item._id !== newItem._id
        ),
      ]);

      resetReportForm();
      setShowForm(false);
      setFilter("All");
      setStatusFilter("All");
      setSearch("");

      setFormMessage("Your report was submitted successfully!");
    } catch (err) {
      setFormMessage(
        err.message || "Unable to submit your report."
      );
    } finally {
      setSubmitting(false);
    }
  }

  // Filter reports by keyword, type, and status.
  const filteredItems = useMemo(() => {
    const keyword = search.toLowerCase().trim();

    return items.filter((item) => {
      const searchableText = [
        item.itemName,
        item.location,
        item.category,
        item.description,
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
  }, [items, search, filter, statusFilter]);

  // Generate possible matches between open Lost and Found reports.
  const possibleMatches = useMemo(() => {
    const openItems = items.filter(
      (item) => (item.status || "Open") === "Open" && item._id
    );

    const lostItems = openItems.filter(
      (item) => item.type === "Lost"
    );

    const foundItems = openItems.filter(
      (item) => item.type === "Found"
    );

    const threshold = Number(minimumMatchScore);

    return lostItems
      .flatMap((lostItem) =>
        foundItems
          .filter(
            (foundItem) => foundItem._id !== lostItem._id
          )
          .map((foundItem) => {
            const details = getMatchDetails(
              lostItem,
              foundItem
            );

            return {
              lostItem,
              foundItem,
              ...details,
            };
          })
          .filter((match) => match.score >= threshold)
      )
      .filter((match) => {
        if (matchFilter === "Strong") {
          return match.score >= 8;
        }

        if (matchFilter === "Category") {
          return (
            normalize(match.lostItem.category) !== "" &&
            normalize(match.lostItem.category) ===
              normalize(match.foundItem.category)
          );
        }

        if (matchFilter === "Location") {
          return (
            normalize(match.lostItem.location) !== "" &&
            normalize(match.lostItem.location) ===
              normalize(match.foundItem.location)
          );
        }

        return true;
      })
      .sort(
        (a, b) =>
          b.score - a.score ||
          String(b.lostItem.date || "").localeCompare(
            String(a.lostItem.date || "")
          )
      );
  }, [items, minimumMatchScore, matchFilter]);

  // Confirm a possible Lost and Found match.
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
        {
          method: "PUT",
          credentials: "include",
        }
      );

      const data = await readResponse(response);
      const updatedItems = data.items || [];

      if (updatedItems.length) {
        setItems((previous) =>
          previous.map(
            (item) =>
              updatedItems.find(
                (record) => record._id === item._id
              ) || item
          )
        );
      } else {
        await loadItems(false);
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

  // Open the edit form on the Report page.
  function startEditing(item) {
    setEditingItem({
      ...item,
      date: item.date
        ? new Date(item.date).toISOString().split("T")[0]
        : new Date().toISOString().split("T")[0],
    });

    setEditSelectedImage(null);
    setEditImagePreview("");
    setActionMessage("");
    setShowForm(false);

    navigate("/report");

    window.setTimeout(() => {
      document.getElementById("edit-item")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 200);
  }

  function cancelEditing() {
    setEditingItem(null);
    setEditSelectedImage(null);
    setEditImagePreview("");
    setActionMessage("");
  }

  // Save edits to an existing report.
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
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...updates,
          imageUrl,
        }),
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
      setEditImagePreview("");

      setActionMessage("Item and photo updated successfully!");
    } catch (err) {
      setActionMessage(
        err.message || "Unable to update the item."
      );
    } finally {
      setActionLoading(false);
    }
  }

  // Delete a report.
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
        method: "DELETE",
        credentials: "include",
      });

      const data = await readResponse(response);

      setItems((previous) =>
        previous.filter(
          (record) => record._id !== item._id
        )
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

  // Submit a claim on a found item.
  async function submitClaim(item) {
    if (actionLoading) return;

    if (claimText.trim().length < 5) {
      setActionMessage("Please describe why this item is yours (at least 5 characters).");
      return;
    }

    setActionLoading(true);
    setActionMessage("");

    try {
      const response = await fetch(`${API_URL}/${item._id}/claims`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: claimText.trim() }),
      });

      const data = await readResponse(response);

      setItems((previous) =>
        previous.map((record) =>
          record._id === item._id ? { ...record, ...data.item } : record
        )
      );

      setClaimingItemId(null);
      setClaimText("");
      setHistoryOpenId(item._id);
      setActionMessage(data.message || "Claim submitted!");
    } catch (err) {
      setActionMessage(err.message || "Claim failed.");
    } finally {
      setActionLoading(false);
    }
  }

  // Admin: approve or reject a claim.
  // An approved claim removes the item (the server moves it to history).
  async function reviewClaim(item, claim, decision) {
    if (actionLoading) return;

    setActionLoading(true);
    setActionMessage("");

    try {
      const response = await fetch(
        `${API_URL}/${item._id}/claims/${claim._id}`,
        {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ decision }),
        }
      );

      const data = await readResponse(response);

      if (data.removedItemId) {
        setItems((previous) =>
          previous.filter(
            (record) => record._id !== data.removedItemId
          )
        );
        setHistoryOpenId(null);
      } else {
        setItems((previous) =>
          previous.map((record) =>
            record._id === item._id ? { ...record, ...data.item } : record
          )
        );
      }

      setActionMessage(data.message || "Claim updated.");
    } catch (err) {
      setActionMessage(err.message || "Review failed.");
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

  function renderPhotoField({ edit = false } = {}) {
    const currentImage = edit
      ? editingItem?.imageUrl
      : "";

    const preview = edit
      ? editImagePreview
      : imagePreview;

    const inputId = edit
      ? "editItemImage"
      : "itemImage";

    const disabled = edit
      ? actionLoading
      : submitting;

    return (
      <div className="full-width image-upload-field">
        <label htmlFor={inputId}>
          {edit
            ? "Replace Item Photo"
            : "Item Photo (optional)"}
        </label>

        <input
          id={inputId}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={
            edit
              ? handleEditImageChange
              : handleImageChange
          }
          disabled={disabled}
        />

        <small>
          JPG, PNG, or WebP. Maximum size: 5 MB.
        </small>

        {(preview || currentImage) && (
          <div
            className={`image-preview ${
              edit ? "edit-image-preview" : ""
            }`}
          >
            <img
              src={preview || getImageSrc(currentImage)}
              alt={
                preview
                  ? "Selected item photo preview"
                  : "Current item photo"
              }
              onError={(event) => {
                event.currentTarget.style.display = "none";
              }}
            />

            <button
              type="button"
              className="remove-image-button"
              disabled={disabled}
              onClick={() => {
                if (edit) {
                  if (preview) {
                    setEditSelectedImage(null);
                  } else {
                    setEditingItem({
                      ...editingItem,
                      imageUrl: "",
                    });
                  }
                } else {
                  setSelectedImage(null);
                  setImagePreview("");
                }

                if (edit && preview) {
                  setEditImagePreview("");
                }

                const input =
                  document.getElementById(inputId);

                if (input) input.value = "";
              }}
            >
              Remove photo
            </button>
          </div>
        )}

        {!edit && (
          <p className="image-upload-note">
            A clear photo can help others identify the item.
          </p>
        )}
      </div>
    );
  }

  return (
    <div
      className={`app page-${
        currentPath.slice(1) || "dashboard"
      }`}
    >
      <Navbar />

      <main className="main-content">
        <header className="topbar">
          <div>
            <p className="breadcrumb">
              Campus Portal / {currentTitle}
            </p>

            <h1>{currentTitle}</h1>
          </div>

          <div className="topbar-actions">
            <div className="top-status">
              <span className="status-dot"></span>
              Campus Community
            </div>

            <button
              type="button"
              className="admin-approvals-nav-btn"
              onClick={() => navigate("/history")}
            >
              ☰ Claim History
            </button>

            {isAdmin && (
              <button
                type="button"
                className="admin-approvals-nav-btn"
                onClick={() => navigate("/students")}
              >
                👥 Students
              </button>
            )}

            {isAdmin && (
              <button
                type="button"
                className="admin-approvals-nav-btn"
                onClick={() =>
                  window.dispatchEvent(
                    new Event("campusfind:show-approvals")
                  )
                }
              >
                ♙ Admin Approvals
              </button>
            )}

            <button
              type="button"
              className="logout-button"
              onClick={() =>
                window.dispatchEvent(
                  new Event("campusfind:logout")
                )
              }
            >
              ↪ Log Out
            </button>
          </div>
        </header>

        {/* DASHBOARD WELCOME */}
        <section
          className="welcome-banner"
          style={{
            display: currentPath === "/" ? "" : "none",
          }}
        >
          <div>
            <p className="eyebrow">
              WELCOME TO CAMPUSFIND
            </p>

            <h2>
              Every item deserves to find its way home.
            </h2>

            <p>
              Browse lost and found reports around your campus
              and help reconnect people with their belongings.
            </p>

            <button
              type="button"
              className="banner-button"
              onClick={() => navigate("/browse")}
            >
              Explore Items →
            </button>
          </div>

          <div className="banner-art">🎒</div>
        </section>

        {/* DASHBOARD STATISTICS */}
        <section
          className="stats-grid"
          style={{
            display: currentPath === "/" ? "" : "none",
          }}
        >
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
            <small>Reports marked matched</small>
          </div>
        </section>

                  {/* DASHBOARD RECENT REPORTS */}
        <section
          className="recent-section"
          style={{
            display: currentPath === "/" ? "" : "none",
          }}
        >
          <div className="section-heading">
            <div>
              <h2>Recent Reports</h2>
              <p>The latest items reported on campus.</p>
            </div>

            <button
              type="button"
              className="recent-view-all"
              onClick={() => navigate("/browse")}
            >
              View all →
            </button>
          </div>

          {items.length === 0 ? (
            <p className="message">No reports yet.</p>
          ) : (
            <ul className="recent-list">
              {items.slice(0, 5).map((item) => (
                <li
                  key={item._id || item.id}
                  className="recent-row"
                >
                  <span
                    className={`item-type ${
                      item.type === "Lost" ? "lost" : "found"
                    }`}
                  >
                    {item.type}
                  </span>

                  <div className="recent-info">
                    <strong>
                      {item.itemName || "Unnamed item"}
                    </strong>

                    <small>
                      📍 {item.location || "Location not provided"}
                      {" · "}
                      {item.date
                        ? new Date(item.date).toLocaleDateString()
                        : "No date"}
                    </small>
                  </div>

                  <span
                    className={`item-status ${String(
                      item.status || "Open"
                    ).toLowerCase()}`}
                  >
                    {item.status || "Open"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
        
        {/* POSSIBLE MATCHES PAGE */}


        <section
          className="matches-section"
          id="matches"
          style={{
            display:
              currentPath === "/matches" ? "" : "none",
          }}
        >
          <div className="section-heading">
            <div>
              <h2>Possible Matches</h2>
              <p>
                Ranked suggestions using names, categories,
                locations, and descriptions.
              </p>
            </div>

            <span className="result-count">
              {possibleMatches.length} suggestions
            </span>
          </div>

          <div className="match-controls">
            <label>
              Match strength
              <select
                value={minimumMatchScore}
                onChange={(event) =>
                  setMinimumMatchScore(event.target.value)
                }
              >
                <option value="3">All suggestions</option>
                <option value="5">Moderate or stronger</option>
                <option value="8">Strong only</option>
              </select>
            </label>

            <label>
              Narrow by
              <select
                value={matchFilter}
                onChange={(event) =>
                  setMatchFilter(event.target.value)
                }
              >
                <option value="All">All details</option>
                <option value="Strong">Strong matches</option>
                <option value="Category">Same category</option>
                <option value="Location">Same location</option>
              </select>
            </label>
          </div>

          {loading && (
            <p className="message">
              Loading possible matches...
            </p>
          )}

          {!loading && possibleMatches.length === 0 && (
            <div className="matches-empty">
              <span>🔎</span>

              <div>
                <h3>No possible matches found</h3>
                <p>
                  Try “All suggestions,” or add more details
                  to Lost and Found reports. Only Open reports
                  are considered.
                </p>
              </div>
            </div>
          )}

          {!loading && possibleMatches.length > 0 && (
            <div className="matches-grid">
              {possibleMatches.map(
                ({
                  lostItem,
                  foundItem,
                  score,
                  percentage,
                  reasons,
                }) => (
                  <article
                    className="match-card"
                    key={`${lostItem._id}-${foundItem._id}`}
                  >
                    <div className="match-card-heading">
                      <span className="match-badge">
                        Possible match
                      </span>

                      <span className="match-score">
                        {score >= 8
                          ? "Strong similarity"
                          : score >= 5
                            ? "Moderate similarity"
                            : "Some similarity"}
                      </span>
                    </div>

                    <div className="match-strength">
                      <div className="match-strength-label">
                        <span>Similarity score</span>
                        <strong>{percentage}%</strong>
                      </div>

                      <div className="match-strength-track">
                        <div
                          className="match-strength-fill"
                          style={{
                            width: `${percentage}%`,
                          }}
                        />
                      </div>

                      <small>
                        This is a ranking score, not a
                        probability of a true match.
                      </small>
                    </div>

                    <div className="match-pair">
                      <div className="match-item lost-match">
                        <small>LOST ITEM</small>

                        {lostItem.imageUrl && (
                          <img
                            className="match-item-image"
                            src={getImageSrc(lostItem.imageUrl)}
                            alt={
                              lostItem.itemName || "Lost item"
                            }
                            onError={(event) => {
                              event.currentTarget.style.display =
                                "none";
                            }}
                          />
                        )}

                        <h3>
                          {lostItem.itemName || "Unnamed item"}
                        </h3>

                        <p>
                          {lostItem.category || "Uncategorized"}
                        </p>

                        <p>
                          📍{" "}
                          {lostItem.location ||
                            "Location not provided"}
                        </p>

                        {lostItem.description && (
                          <p className="match-description">
                            {lostItem.description}
                          </p>
                        )}

                        <small>
                          {lostItem.date
                            ? new Date(
                                lostItem.date
                              ).toLocaleDateString()
                            : "Date not provided"}
                        </small>
                      </div>

                      <div className="match-arrow">↔</div>

                      <div className="match-item found-match">
                        <small>FOUND ITEM</small>

                        {foundItem.imageUrl && (
                          <img
                            className="match-item-image"
                            src={getImageSrc(foundItem.imageUrl)}
                            alt={
                              foundItem.itemName || "Found item"
                            }
                            onError={(event) => {
                              event.currentTarget.style.display =
                                "none";
                            }}
                          />
                        )}

                        <h3>
                          {foundItem.itemName || "Unnamed item"}
                        </h3>

                        <p>
                          {foundItem.category || "Uncategorized"}
                        </p>

                        <p>
                          📍{" "}
                          {foundItem.location ||
                            "Location not provided"}
                        </p>

                        {foundItem.description && (
                          <p className="match-description">
                            {foundItem.description}
                          </p>
                        )}

                        <small>
                          {foundItem.date
                            ? new Date(
                                foundItem.date
                              ).toLocaleDateString()
                            : "Date not provided"}
                        </small>
                      </div>
                    </div>

                    <div className="match-reasons">
                      <strong>Why it was suggested</strong>

                      {reasons.length ? (
                        <ul>
                          {reasons.map((reason) => (
                            <li key={reason}>{reason}</li>
                          ))}
                        </ul>
                      ) : (
                        <p>
                          Some item details are similar.
                        </p>
                      )}
                    </div>

                    <p className="match-note">
                      Compare both reports carefully before
                      confirming. Only confirm when you have
                      verified that they refer to the same item.
                    </p>

                    <button
                      type="button"
                      className="confirm-match-button"
                      disabled={actionLoading}
                      onClick={() =>
                        confirmMatch(lostItem, foundItem)
                      }
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

        {/* REPORT ITEM PAGE */}
        <section
          className="report-section"
          id="report"
          style={{
            display:
              currentPath === "/report" ? "" : "none",
          }}
        >
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
              {showForm
                ? "Close Form −"
                : "+ Report an Item"}
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
            <form
              className="report-form"
              onSubmit={handleSubmit}
            >
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
                      updateField(
                        "contactInfo",
                        event.target.value
                      )
                    }
                    placeholder="Email or phone"
                  />
                </label>

                {renderPhotoField()}

                <label className="full-width">
                  Description
                  <textarea
                    rows="3"
                    value={formData.description}
                    onChange={(event) =>
                      updateField(
                        "description",
                        event.target.value
                      )
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
                {submitting
                  ? "Uploading and submitting..."
                  : "Submit Report"}
              </button>
            </form>
          )}
        </section>

        {/* EDIT ITEM FORM */}
        {editingItem && (
          <section
            className="report-section edit-section"
            id="edit-item"
            style={{
              display:
                currentPath === "/report" ? "" : "none",
            }}
          >
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

            <form
              className="report-form"
              onSubmit={saveEdit}
            >
              <div className="form-grid">
                <label>
                  Item Name *
                  <input
                    required
                    value={editingItem.itemName || ""}
                    onChange={(event) =>
                      setEditingItem({
                        ...editingItem,
                        itemName: event.target.value,
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
                        type: event.target.value,
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
                        category: event.target.value,
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
                        location: event.target.value,
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
                        date: event.target.value,
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
                        status: event.target.value,
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
                        contactInfo: event.target.value,
                      })
                    }
                  />
                </label>

                {renderPhotoField({ edit: true })}

                <label className="full-width">
                  Description
                  <textarea
                    rows="3"
                    value={editingItem.description || ""}
                    onChange={(event) =>
                      setEditingItem({
                        ...editingItem,
                        description: event.target.value,
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
                {actionLoading
                  ? "Saving changes..."
                  : "Save Changes"}
              </button>
            </form>
          </section>
        )}

        {actionMessage && (
          <p className="form-message" role="status">
            {actionMessage}
          </p>
        )}

        {/* BROWSE ITEMS PAGE */}
        <section
          className="items-section"
          id="items"
          style={{
            display:
              currentPath === "/browse" ? "" : "none",
          }}
        >
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
                onChange={(event) =>
                  setSearch(event.target.value)
                }
              />
            </div>

            <div className="filter-buttons">
              {["All", "Lost", "Found"].map((type) => (
                <button
                  type="button"
                  key={type}
                  className={
                    filter === type
                      ? "filter-btn selected"
                      : "filter-btn"
                  }
                  onClick={() => setFilter(type)}
                >
                  {type}
                </button>
              ))}
            </div>

            <div className="status-filter">
              <label htmlFor="statusFilter">
                Item Status
              </label>

              <select
                id="statusFilter"
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value)
                }
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

          {loading && (
            <p className="message">
              Loading reported items...
            </p>
          )}

          {error && (
            <p className="message error">{error}</p>
          )}

          {!loading &&
            !error &&
            filteredItems.length === 0 && (
              <div className="empty-state">
                <span>🔍</span>
                <h3>No items found</h3>
                <p>
                  Try a different search or select another
                  type or status filter.
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
                        alt={
                          item.itemName || "Reported item"
                        }
                        loading="lazy"
                        onError={(event) => {
                          event.currentTarget.style.display =
                            "none";

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

                  <h3>
                    {item.itemName || "Unnamed item"}
                  </h3>

                  <p className="item-description">
                    {item.description ||
                      "No description provided."}
                  </p>

                  <div className="item-meta">
                    <span>
                      📍{" "}
                      {item.location ||
                        "Location not provided"}
                    </span>

                    <span>
                      📅{" "}
                      {item.date
                        ? new Date(
                            item.date
                          ).toLocaleDateString()
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

                    <span className="item-reference">
                      Campus report
                    </span>
                  </div>

                  {item.type === "Found" &&
                    item.status !== "Claimed" &&
                    (claimingItemId === item._id ? (
                      <div className="claim-form">
                        <textarea
                          rows="3"
                          maxLength="500"
                          placeholder="Why is this yours? Describe something only the owner would know."
                          value={claimText}
                          onChange={(event) => setClaimText(event.target.value)}
                        />

                        <div className="claim-form-buttons">
                          <button
                            type="button"
                            className="claim-submit"
                            disabled={actionLoading}
                            onClick={() => submitClaim(item)}
                          >
                            Send claim
                          </button>

                          <button
                            type="button"
                            className="claim-cancel"
                            onClick={() => {
                              setClaimingItemId(null);
                              setClaimText("");
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="claim-button"
                        onClick={() => {
                          setClaimingItemId(item._id);
                          setClaimText("");
                        }}
                      >
                        This is mine - Claim it
                      </button>
                    ))}

                  {item.claims && item.claims.length > 0 && (
                    <div className="claim-history">
                      <button
                        type="button"
                        className="history-toggle"
                        onClick={() =>
                          setHistoryOpenId(
                            historyOpenId === item._id ? null : item._id
                          )
                        }
                      >
                        Claim history ({item.claims.length})
                      </button>

                      {historyOpenId === item._id && (
                        <ul className="history-list">
                          {item.claims.map((claim) => (
                            <li key={claim._id}>
                              <div className="history-row">
                                <strong>{claim.claimantName}</strong>
                                <span
                                  className={`claim-status ${String(
                                    claim.status
                                  ).toLowerCase()}`}
                                >
                                  {claim.status}
                                </span>
                              </div>

                              <p>{claim.message}</p>

                              <small>
                                {new Date(claim.createdAt).toLocaleString()}
                                {claim.reviewedByName
                                  ? ` - reviewed by ${claim.reviewedByName}`
                                  : ""}
                              </small>

                              {isAdmin && claim.status === "Pending" && (
                                <div className="claim-review">
                                  <button
                                    type="button"
                                    className="approve-button"
                                    disabled={actionLoading}
                                    onClick={() =>
                                      reviewClaim(item, claim, "Approved")
                                    }
                                  >
                                    Approve
                                  </button>

                                  <button
                                    type="button"
                                    className="reject-button"
                                    disabled={actionLoading}
                                    onClick={() =>
                                      reviewClaim(item, claim, "Rejected")
                                    }
                                  >
                                    Reject
                                  </button>
                                </div>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}

                  <div className="item-actions" style={{ display: item.canModify ? "" : "none" }}>
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

        {/* CLAIM HISTORY PAGE (ADMIN ONLY) */}
        <section
          className="items-section"
          id="claim-history"
          style={{
            display:
              currentPath === "/history" ? "" : "none",
          }}
        >
          <div className="section-heading">
            <div>
              <h2>Claim History</h2>
              <p>
                Items that were claimed and returned to their
                owners.
              </p>
            </div>

            <span className="result-count">
              {claimHistory.length} records
            </span>
          </div>

          {!isAdmin && (
            <p className="message">
              Showing only the items you claimed.
            </p>
          )}

          {claimHistory.length === 0 && (
            <p className="message">No claimed items yet.</p>
          )}

          <div className="items-grid">
            {claimHistory.map((entry) => (
              <article className="item-card" key={entry._id}>
                <div className="item-details">
                  {entry.imageUrl && (
                    <img
                      className="match-item-image"
                      src={getImageSrc(entry.imageUrl)}
                      alt={entry.itemName || "Claimed item"}
                      onError={(event) => {
                        event.currentTarget.style.display =
                          "none";
                      }}
                    />
                  )}

                  <span className="category-label">
                    {entry.category || "Uncategorized"}
                  </span>

                  <h3>{entry.itemName || "Unnamed item"}</h3>

                  <p>
                    📍 {entry.location || "Location not provided"}
                  </p>

                  <p>
                    Claimed by{" "}
                    <strong>
                      {entry.approvedClaim?.claimantName ||
                        "Unknown"}
                    </strong>
                  </p>

                  <p className="item-description">
                    {entry.approvedClaim?.message}
                  </p>

                  <small>
                    Approved by {entry.approvedByName || "admin"}{" "}
                    on{" "}
                    {entry.approvedAt
                      ? new Date(
                          entry.approvedAt
                        ).toLocaleString()
                      : "unknown date"}
                  </small>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* REGISTERED STUDENTS PAGE (ADMIN ONLY) */}
        <section
          className="items-section"
          id="students"
          style={{
            display:
              currentPath === "/students" ? "" : "none",
          }}
        >
          <div className="section-heading">
            <div>
              <h2>Registered Students</h2>
              <p>
                See every student account and set a new password
                when a student forgets theirs.
              </p>
            </div>

            <span className="result-count">
              {students.length} students
            </span>
          </div>

          {!isAdmin && (
            <p className="message error">
              Only administrators can view this page.
            </p>
          )}

          {isAdmin && (
            <>
              <div className="search-toolbar">
                <div className="search-box">
                  <span>⌕</span>

                  <input
                    type="text"
                    placeholder="Search by name, email, or student ID..."
                    value={studentSearch}
                    onChange={(event) =>
                      setStudentSearch(event.target.value)
                    }
                  />
                </div>
              </div>

              {students.length === 0 && (
                <p className="message">
                  No registered students yet.
                </p>
              )}

              <div className="items-grid">
                {students
                  .filter((student) =>
                    [
                      student.fullName,
                      student.email,
                      student.studentId,
                    ]
                      .join(" ")
                      .toLowerCase()
                      .includes(
                        studentSearch.toLowerCase().trim()
                      )
                  )
                  .map((student) => (
                    <article
                      className="item-card"
                      key={student.id}
                    >
                      <div className="item-details">
                        <span className="category-label">
                          {student.courseYear}
                        </span>

                        <h3>{student.fullName}</h3>

                        <p>✉️ {student.email}</p>
                        <p>🪪 ID: {student.studentId}</p>

                        <div className="item-card-footer">
                          <span
                            className={`item-status ${String(
                              student.status
                            ).toLowerCase()}`}
                          >
                            {student.status}
                          </span>

                          {student.resetRequested && (
                            <span className="item-status matched">
                              Password reset requested
                            </span>
                          )}
                        </div>

                        <div className="item-actions">
                          <button
                            type="button"
                            className="edit-button"
                            onClick={() =>
                              resetStudentPassword(student)
                            }
                          >
                            🔑 Set new password
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
              </div>
            </>
          )}
        </section>

        {/* AI ASSISTANT PAGE */}
        <section
          className="ai-assistant-section"
          id="ai-assistant"
          style={{
            display:
              currentPath === "/assistant" ? "" : "none",
          }}
        >
          <div className="section-heading">
            <div>
              <h2>CampusFind AI Assistant</h2>
              <p>
                Get guidance about lost and found items
                with your local AI assistant.
              </p>
            </div>

            <span className="result-count">
              AI Assistant
            </span>
          </div>

          <Chatbot />
        </section>

        <footer className="page-footer">
          CampusFind · Lost &amp; Found
        </footer>
      </main>
    </div>
  );
}

export default App;
