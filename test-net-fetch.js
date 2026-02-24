const { app, protocol, net } = require('electron');

app.whenReady().then(() => {
  protocol.handle('media', (request) => {
    const url = request.url.replace("media://", "");
    const decodedPath = decodeURIComponent(url);
    console.log("decodedPath:", decodedPath);
    console.log("Making fetch to:", "file://" + decodedPath);
    return net.fetch("file://" + decodedPath);
  });
  
  net.fetch('media://%2FUsers%2Fvivekvishnoi%2FFile-Organizer%2Ftest-images%2FScreenshot%202026-02-23%20at%2010.00.00.png')
    .then(res => {
      console.log("Status:", res.status);
      app.quit();
    })
    .catch(err => {
      console.error("Fetch error:", err.message);
      app.quit();
    });
});
