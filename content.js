let subtitleCues = []; // Array of { start: seconds, end: seconds, text: string }
let subtitleElement = null;
let retryCount = 0;
let currentVideoId = null;
let isLoadingSubtitles = false;

// Function to parse SRT text
function parseSRT(srtText) {
  const cues = [];
  const lines = srtText.trim().split(/\r?\n\r?\n/); // Split by subtitle blocks
  lines.forEach(block => {
    const blockLines = block.split(/\r?\n/);
    if (blockLines.length < 3) return;

    const index = parseInt(blockLines[0]);
    const time = blockLines[1].split(' --> ');
    const start = time[0].split(/[:,]/).reduce((acc, t, i) => acc + parseInt(t) * (i === 0 ? 3600 : i === 1 ? 60 : i === 2 ? 1 : 0.001), 0);
    const end = time[1].split(/[:,]/).reduce((acc, t, i) => acc + parseInt(t) * (i === 0 ? 3600 : i === 1 ? 60 : i === 2 ? 1 : 0.001), 0);
    const text = blockLines.slice(2).join('\n');

    cues.push({ start, end, text });
  });
  return cues;
}

// Create subtitle overlay element
function createSubtitleElement(video) {
  // Check if dual-sub extension is present
  let dualSubContainer = document.getElementById('dual-sub');
  
  if (dualSubContainer) {
    
    // Find the subtitle container within dual-sub
    let subtitleContainer = dualSubContainer.querySelector('#subtitle');
    if (!subtitleContainer) {
      // If dual-sub exists but has no #subtitle, create one
      subtitleContainer = document.createElement('div');
      subtitleContainer.id = 'subtitle';
      subtitleContainer.setAttribute('data-testid', 'Subtitle');
      subtitleContainer.className = 'inline-flex items-center outline-none';
      subtitleContainer.style.cssText = 'flex-direction: column; gap: 0px;';
      
      // Find the main subtitle container and append our subtitle div to it
      const mainContainer = dualSubContainer.querySelector('[data-testid="SubtitleContainer"]');
      if (mainContainer) {
        mainContainer.appendChild(subtitleContainer);
      } else {
        return null;
      }
    }
    
    // Check if our subtitle already exists
    let existingSubtitle = subtitleContainer.querySelector('#srt-youtube-subtitle');
    if (existingSubtitle) {
      // Return the existing text div
      return existingSubtitle.querySelector('.notranslate.text-selection');
    }
    
    // dual-sub exists but our subtitle doesn't, add our subtitles as the last element in #subtitle
    const ourSubtitleDiv = document.createElement('div');
    ourSubtitleDiv.id = 'srt-youtube-subtitle';
    ourSubtitleDiv.className = 'response-size relative inline-flex items-center px-1.5 py-1 leading-none ring-[--background] transition-[font-weight] duration-200 ease-linear [text-align-last:center] has-[#border]:z-10 has-[#border]:rounded has-[#border]:ring-[1.7px] group-has-[#stylebar]/subtitle:cursor-pointer';
    ourSubtitleDiv.style.cssText = 'font-family: Roboto; font-size: calc(20px * var(--percentage, 1)); color: rgb(255, 255, 255); background: var(--background); --background: hsl(0 0% 0% / 1); --percentage: 1;';
    
    const textDiv = document.createElement('div');
    textDiv.className = 'notranslate text-selection';
    ourSubtitleDiv.appendChild(textDiv);
    
    // Add our subtitle as the last element in the subtitle container
    subtitleContainer.appendChild(ourSubtitleDiv);
    
    // Make sure the dual-sub container is visible (it might be hidden when no dual-sub subtitles exist)
    const computedStyle = window.getComputedStyle(dualSubContainer);
    if (computedStyle.display === 'none') {
      dualSubContainer.style.setProperty('display', 'block', 'important');
    }
    
    retryCount = 0; // Reset retry count on success
    return textDiv; // Return the text div for content updates
  } else {
    // dual-sub doesn't exist, create our own container with similar styling but different ID
    const srtSubDiv = document.createElement('div');
    srtSubDiv.id = 'srt-youtube-container'; // Use different ID to avoid conflicts
    
    const subtitleContainer = document.createElement('div');
    subtitleContainer.setAttribute('data-testid', 'SubtitleContainer');
    subtitleContainer.id = 'srtSubtitleContainer'; // Use different ID
    subtitleContainer.dir = 'ltr';
    subtitleContainer.className = 'group/subtitle absolute z-[80] inline-flex flex-col items-start font-subtitle peer/subtitle min-w-[71px] [--distance:0]';
    subtitleContainer.style.cssText = 'left: calc(50% - var(--translate-x)); bottom: 14.8193%; --distance: 0px; --translate-x: 0px;';
    
    const subtitleDiv = document.createElement('div');
    subtitleDiv.id = 'srtSubtitle'; // Use different ID
    subtitleDiv.setAttribute('data-testid', 'Subtitle');
    subtitleDiv.className = 'inline-flex items-center outline-none';
    subtitleDiv.style.cssText = 'flex-direction: column; gap: 0px;';
    
    const ourSubtitleDiv = document.createElement('div');
    ourSubtitleDiv.id = 'srt-youtube-subtitle';
    ourSubtitleDiv.className = 'response-size relative inline-flex items-center px-1.5 py-1 leading-none ring-[--background] transition-[font-weight] duration-200 ease-linear [text-align-last:center] has-[#border]:z-10 has-[#border]:rounded has-[#border]:ring-[1.7px] group-has-[#stylebar]/subtitle:cursor-pointer';
    ourSubtitleDiv.style.cssText = 'font-family: Roboto; font-size: calc(20px * var(--percentage, 1)); color: rgb(255, 255, 255); background: var(--background); --background: hsl(0 0% 0% / 1); --percentage: 1;';
    
    const textDiv = document.createElement('div');
    textDiv.className = 'notranslate text-selection';
    ourSubtitleDiv.appendChild(textDiv);
    
    subtitleDiv.appendChild(ourSubtitleDiv);
    subtitleContainer.appendChild(subtitleDiv);
    srtSubDiv.appendChild(subtitleContainer);
    
    // Find video container and append
    const videoContainer = video.closest('#movie_player') || video.parentElement;
    videoContainer.appendChild(srtSubDiv);
    
    retryCount = 0; // Reset retry count on success
    return textDiv; // Return the text div for content updates
  }
}

// Update subtitles on timeupdate
function updateSubtitles(video, currentTime) {
  const activeCue = subtitleCues.find(cue => currentTime >= cue.start && currentTime < cue.end);
  subtitleElement.textContent = activeCue ? activeCue.text : '';
}

// Load subtitles for current video
function loadSubtitles(attempt = 1) {
  // Prevent multiple simultaneous calls
  if (isLoadingSubtitles) {
    return;
  }
  
  const video = document.querySelector('video');
  if (!video) return;

  isLoadingSubtitles = true;
  
  // Check for video change FIRST and clear old subtitles immediately
  const videoId = new URL(location.href).searchParams.get('v');
  if (currentVideoId !== videoId) {
    currentVideoId = videoId;
    
    // Clear old subtitles immediately
    subtitleCues = [];
    if (subtitleElement) {
      subtitleElement.textContent = '';
    }
  }
  
  // Check if dual-sub might be loading by looking for any dual-sub related elements
  const dualSubExists = document.getElementById('dual-sub');
  
  // More comprehensive dual-sub detection
  const dualSubScripts = document.querySelectorAll('script[src*="dual"]');
  const dualSubExtensionId = 'kgeafemaimclcnniglnnpapilhnpnicf'; // Common dual-sub extension ID
  const hasExtensionElements = document.querySelector(`[data-extension-id="${dualSubExtensionId}"]`);
  const hasDualSubClasses = document.querySelector('[class*="dual"], [id*="dual"]');
  const hasDualSubInStorage = localStorage.getItem('dual-sub') || sessionStorage.getItem('dual-sub');
  
  // Check if we're still early in page load (dual-sub might load later)
  const isEarlyLoad = attempt <= 3 && document.readyState !== 'complete';
  
  const hasDualSubExtension = dualSubScripts.length > 0 || 
                             window.dualSub || 
                             hasExtensionElements || 
                             hasDualSubClasses ||
                             hasDualSubInStorage ||
                             isEarlyLoad;
  
  // If we think dual-sub extension might be installed but container doesn't exist yet, wait
  if (!dualSubExists && (hasDualSubExtension || attempt <= 3) && attempt <= 8) {
    setTimeout(() => loadSubtitles(attempt + 1), attempt <= 3 ? 2000 : 1000);
    return;
  }

  // Remove our subtitle element (whether it's in dual-sub or standalone)
  const existingElement = document.getElementById('srt-youtube-subtitle');
  if (existingElement) {
    existingElement.remove();
  }
  
  // Also remove our standalone container if it exists (for when dual-sub is not present)
  const existingContainer = document.getElementById('srt-youtube-container');
  if (existingContainer) {
    existingContainer.remove();
  }
  
  subtitleElement = createSubtitleElement(video);
  
  // If createSubtitleElement returned null (dual-sub exists but not ready), don't proceed
  if (!subtitleElement) {
    isLoadingSubtitles = false;
    return;
  }

  chrome.storage.local.get(`subtitles_${videoId}`, (data) => {
    const srt = data[`subtitles_${videoId}`];
    if (srt) {
      subtitleCues = parseSRT(srt);
      // Remove any existing timeupdate listeners to avoid duplicates
      video.removeEventListener('timeupdate', updateSubtitlesHandler);
      video.addEventListener('timeupdate', updateSubtitlesHandler);
    } else {
      // Clear subtitles if no SRT file exists for this video
      subtitleCues = [];
      if (subtitleElement) {
        subtitleElement.textContent = '';
      }
    }
    
    // Reset loading flag
    isLoadingSubtitles = false;
  });
}

// Create a named function for the event handler to allow removal
function updateSubtitlesHandler() {
  const video = document.querySelector('video');
  if (video && subtitleElement) {
    updateSubtitles(video, video.currentTime);
  }
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === 'loadSubtitles') loadSubtitles();
});

// Watch for dual-sub extension changes
function setupDualSubObserver() {
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      // Check if dual-sub was added or removed, but ignore our own subtitle changes
      if (mutation.type === 'childList') {
        const addedNodes = Array.from(mutation.addedNodes);
        const removedNodes = Array.from(mutation.removedNodes);
        
        // Ignore changes to our own subtitle element
        const isOurSubtitle = (node) => 
          node.id === 'srt-youtube-subtitle' || 
          node.id === 'srt-youtube-container' ||
          (node.querySelector && (node.querySelector('#srt-youtube-subtitle') || node.querySelector('#srt-youtube-container')));
        
        const dualSubAdded = addedNodes.some(node => 
          node.id === 'dual-sub' || (node.querySelector && node.querySelector('#dual-sub'))
        ) && !addedNodes.some(isOurSubtitle);
        
        const dualSubRemoved = removedNodes.some(node => 
          node.id === 'dual-sub' || (node.querySelector && node.querySelector('#dual-sub'))
        ) && !removedNodes.some(isOurSubtitle);
        
        if (dualSubAdded) {
          setTimeout(() => loadSubtitles(1), 500); // Give dual-sub time to fully initialize
        } else if (dualSubRemoved) {
          setTimeout(() => loadSubtitles(1), 100);
        }
      }
    });
  });
  
  // Observe the video container for changes
  const videoContainer = document.querySelector('#movie_player') || document.body;
  if (videoContainer) {
    observer.observe(videoContainer, {
      childList: true,
      subtree: true
    });
  }
}

// Initial load if subtitles already exist
loadSubtitles();

// Setup observer after a short delay to ensure page is loaded
setTimeout(setupDualSubObserver, 1000);

// URL change detection for video switching
let lastUrl = location.href;

setInterval(() => {
  const currentUrl = location.href;
  if (currentUrl !== lastUrl) {
    lastUrl = currentUrl;
    setTimeout(() => loadSubtitles(1), 200);
  }
}, 500);

// Also try listening to browser navigation events
window.addEventListener('popstate', () => {
  setTimeout(() => loadSubtitles(1), 200);
});

// Listen for YouTube's custom events
document.addEventListener('yt-navigate-start', () => {
  // Navigation started
});

document.addEventListener('yt-navigate-finish', () => {
  setTimeout(() => loadSubtitles(1), 200);
});

// Watch for changes in the video element itself
function watchVideoChanges() {
  const video = document.querySelector('video');
  if (video) {
    video.addEventListener('loadstart', () => {
      setTimeout(() => loadSubtitles(1), 100);
    });
    
    video.addEventListener('loadedmetadata', () => {
      setTimeout(() => loadSubtitles(1), 100);
    });
  }
}

// Setup video watching
setTimeout(watchVideoChanges, 1000);

// Periodic check for dual-sub in case it loads later
let periodicCheckCount = 0;
const periodicCheck = setInterval(() => {
  periodicCheckCount++;
  const dualSubExists = document.getElementById('dual-sub');
  const ourStandaloneExists = document.getElementById('srt-youtube-container');
  
  // If dual-sub appeared and we have a standalone container, switch to integration
  if (dualSubExists && ourStandaloneExists) {
    loadSubtitles(1);
  }
  
  // Stop checking after 30 seconds
  if (periodicCheckCount >= 30) {
    clearInterval(periodicCheck);
  }
}, 1000);