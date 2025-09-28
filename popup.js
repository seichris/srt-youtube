document.getElementById('saveBtn').addEventListener('click', () => {
    const srtText = document.getElementById('srtInput').value;
    if (!srtText) return alert('No SRT content provided');
  
    // Get current tab (YouTube page)
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const videoId = new URL(tabs[0].url).searchParams.get('v'); // Extract YouTube video ID
      if (!videoId) return alert('Not on a YouTube video page');
  
      // Store SRT for this video ID
      chrome.storage.local.set({ [`subtitles_${videoId}`]: srtText }, () => {
        // Notify content script to load subtitles
        chrome.tabs.sendMessage(tabs[0].id, { action: 'loadSubtitles' });
        alert('Subtitles saved! They should appear on the video.');
      });
    });
  });