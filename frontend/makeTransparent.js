const Jimp = require('jimp');
const path = require('path');

async function processImage(fileName) {
  const filePath = path.join(__dirname, 'assets', 'splash', fileName);
  try {
    const image = await Jimp.read(filePath);
    console.log(`Processing ${fileName}...`);
    
    // Ensure the image has an alpha channel
    image.rgba(true);
    
    image.scan(0, 0, image.bitmap.width, image.bitmap.height, function(x, y, idx) {
      const red = this.bitmap.data[idx + 0];
      const green = this.bitmap.data[idx + 1];
      const blue = this.bitmap.data[idx + 2];
      
      const lum = Math.max(red, green, blue);
      
      let alpha = lum;
      // If it's a very dark pixel, make it perfectly transparent
      if (lum < 30) {
          alpha = 0;
      } else {
          // Boost opacity of the glowing lines so they stay bright
          alpha = Math.min(255, lum * 1.8);
      }
      
      this.bitmap.data[idx + 3] = alpha;
    });
    
    await image.writeAsync(filePath);
    console.log(`Saved transparent image to ${filePath}`);
  } catch (err) {
    console.error(`Error processing ${fileName}:`, err);
  }
}

async function main() {
  await processImage('boy.png');
  await processImage('girl.png');
  await processImage('map.png');
}

main();
