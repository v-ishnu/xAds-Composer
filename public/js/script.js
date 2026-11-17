// =========================================================
// ELEMENTS
// =========================================================

const creativeName = document.getElementById("creativeName");

const nameCounter = document.getElementById("nameCounter");

const postText = document.getElementById("postText");

const characterCount = document.getElementById("characterCount");

const previewText = document.getElementById("previewText");

const websiteDestination = document.getElementById("websiteDestination");

const websiteDetails = document.getElementById("websiteDetails");

const websiteUrl = document.getElementById("websiteUrl");

const headline = document.getElementById("headline");

const previewWebsite = document.getElementById("previewWebsite");

const previewWebsiteUrl = document.getElementById("previewWebsiteUrl");

const previewHeadline = document.getElementById("previewHeadline");

const addMediaButton = document.getElementById("addMediaButton");

const mediaInput = document.getElementById("mediaInput");

const mediaItem = document.getElementById("mediaItem");

const mediaThumbnail = document.getElementById("mediaThumbnail");

const mediaName = document.getElementById("mediaName");

const removeMedia = document.getElementById("removeMedia");

const previewMedia = document.getElementById("previewMedia");

const madeWithAI = document.getElementById("madeWithAI");

const promotedOnly = document.getElementById("promotedOnly");

const postButton = document.getElementById("postButton");

// =========================================================
// STATE
// =========================================================

let selectedMedia = null;

let selectedMediaURL = null;

// =========================================================
// NAME COUNTER
// =========================================================

creativeName.addEventListener("input", () => {
  const length = creativeName.value.length;

  nameCounter.textContent = `${length}/255`;
});

// =========================================================
// POST TEXT
// =========================================================

postText.addEventListener("input", () => {
  const text = postText.value;

  characterCount.textContent = text.length;

  updatePostPreview();
});

// =========================================================
// UPDATE POST PREVIEW
// =========================================================

function updatePostPreview() {
  const text = postText.value.trim();

  if (text === "") {
    previewText.textContent = "What's happening?";

    return;
  }

  previewText.textContent = text;
}

// =========================================================
// WEBSITE DESTINATION
// =========================================================

websiteDestination.addEventListener("click", () => {
  websiteDestination.classList.add("active");

  websiteDetails.style.display = "block";
});

// =========================================================
// WEBSITE URL
// =========================================================

websiteUrl.addEventListener("input", () => {
  updateWebsitePreview();
});

// =========================================================
// HEADLINE
// =========================================================

headline.addEventListener("input", () => {
  updateWebsitePreview();
});

// =========================================================
// UPDATE WEBSITE PREVIEW
// =========================================================

function updateWebsitePreview() {
  const url = websiteUrl.value.trim();

  const headlineText = headline.value.trim();

  if (url === "" && headlineText === "") {
    previewWebsite.style.display = "none";

    return;
  }

  previewWebsite.style.display = "flex";

  if (url !== "") {
    previewWebsiteUrl.textContent = formatWebsiteUrl(url);
  } else {
    previewWebsiteUrl.textContent = "website.com";
  }

  previewHeadline.textContent = headlineText;
}

// =========================================================
// FORMAT WEBSITE URL
// =========================================================

function formatWebsiteUrl(url) {
  let formattedUrl = url.trim();

  formattedUrl = formattedUrl.replace(/^https?:\/\//i, "");

  formattedUrl = formattedUrl.replace(/^www\./i, "");

  return formattedUrl;
}

// =========================================================
// OPEN MEDIA SELECTOR
// =========================================================

addMediaButton.addEventListener("click", () => {
  mediaInput.click();
});

// =========================================================
// MEDIA SELECTION
// =========================================================

mediaInput.addEventListener("change", () => {
  const file = mediaInput.files[0];

  if (!file) {
    return;
  }

  if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
    alert("Please select an image or video.");

    mediaInput.value = "";

    return;
  }

  selectedMedia = file;

  if (selectedMediaURL) {
    URL.revokeObjectURL(selectedMediaURL);
  }

  selectedMediaURL = URL.createObjectURL(file);

  mediaName.textContent = file.name;

  mediaItem.style.display = "flex";

  if (file.type.startsWith("image/")) {
    showImage(file);
  } else {
    showVideo(file);
  }
});

// =========================================================
// SHOW IMAGE
// =========================================================

function showImage(file) {
  const imageURL = URL.createObjectURL(file);

  mediaThumbnail.style.display = "block";

  mediaThumbnail.src = imageURL;

  mediaThumbnail.alt = file.name;

  previewMedia.innerHTML = "";

  const previewImage = document.createElement("img");

  previewImage.src = imageURL;

  previewImage.alt = "Selected media";

  previewMedia.appendChild(previewImage);

  previewMedia.style.display = "block";
}

// =========================================================
// SHOW VIDEO
// =========================================================

function showVideo(file) {
  const videoURL = URL.createObjectURL(file);

  mediaThumbnail.style.display = "none";

  const oldThumbnailVideo = document.querySelector(".video-thumbnail");

  if (oldThumbnailVideo) {
    oldThumbnailVideo.remove();
  }

  const thumbnailVideo = document.createElement("video");

  thumbnailVideo.className = "video-thumbnail";

  thumbnailVideo.src = videoURL;

  thumbnailVideo.muted = true;

  thumbnailVideo.autoplay = true;

  thumbnailVideo.loop = true;

  thumbnailVideo.playsInline = true;

  thumbnailVideo.style.width = "100%";

  thumbnailVideo.style.height = "100%";

  thumbnailVideo.style.objectFit = "cover";

  document.querySelector(".media-thumbnail").appendChild(thumbnailVideo);

  // Preview video

  previewMedia.innerHTML = "";

  const previewVideo = document.createElement("video");

  previewVideo.src = videoURL;

  previewVideo.controls = true;

  previewVideo.muted = true;

  previewVideo.playsInline = true;

  previewMedia.appendChild(previewVideo);

  previewMedia.style.display = "block";
}

// =========================================================
// REMOVE MEDIA
// =========================================================

removeMedia.addEventListener("click", () => {
  clearMedia();
});

// =========================================================
// CLEAR MEDIA
// =========================================================

function clearMedia() {
  selectedMedia = null;

  mediaInput.value = "";

  mediaItem.style.display = "none";

  previewMedia.innerHTML = "";

  previewMedia.style.display = "none";

  mediaThumbnail.src = "";

  mediaThumbnail.style.display = "block";

  const thumbnailVideo = document.querySelector(".video-thumbnail");

  if (thumbnailVideo) {
    thumbnailVideo.remove();
  }

  if (selectedMediaURL) {
    URL.revokeObjectURL(selectedMediaURL);

    selectedMediaURL = null;
  }
}

// =========================================================
// POST BUTTON
// =========================================================

postButton.addEventListener("click", () => {
  const name = creativeName.value.trim();

  const text = postText.value.trim();

  const url = websiteUrl.value.trim();

  const headlineText = headline.value.trim();

  // ---------------------------------------------
  // Validate post text
  // ---------------------------------------------

  if (text === "") {
    alert("Please enter some post text.");

    postText.focus();

    return;
  }

  // ---------------------------------------------
  // Validate 280 characters
  // ---------------------------------------------

  if (text.length > 280) {
    alert("Post text cannot exceed 280 characters.");

    postText.focus();

    return;
  }

  // ---------------------------------------------
  // Validate website
  // ---------------------------------------------

  if (url === "") {
    alert("Please enter a website URL.");

    websiteUrl.focus();

    return;
  }

  // ---------------------------------------------
  // Create post object
  // ---------------------------------------------

  const postData = {
    name: name,
    text: text,
    destination: "website",
    website: {
      url: url,
      headline: headlineText,
    },
    madeWithAI: madeWithAI.checked,
    promotedOnly: promotedOnly.checked,
    media: selectedMedia,
  };

  console.log("Post data collected:", postData);
});

// =========================================================
// INITIALIZE
// =========================================================

function initializeComposer() {
  // Name counter

  nameCounter.textContent = `${creativeName.value.length}/255`;

  // Character counter

  characterCount.textContent = postText.value.length;

  // Post preview

  updatePostPreview();

  // Website is selected by default

  websiteDetails.style.display = "block";
}

initializeComposer();
