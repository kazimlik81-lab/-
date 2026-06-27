const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

const projectRoot = path.resolve(__dirname, '..');

const colors = {
  teal: hexColor('#0E5A51'),
  blue: hexColor('#1589C9'),
  mint: hexColor('#82F0C3'),
  coral: hexColor('#FFB45A'),
  white: hexColor('#F7FFFB'),
  shadow: hexColor('#062A34'),
  monochrome: hexColor('#000000'),
};

const launcherDensities = [
  { name: 'mdpi', iconSize: 48, adaptiveSize: 108 },
  { name: 'hdpi', iconSize: 72, adaptiveSize: 162 },
  { name: 'xhdpi', iconSize: 96, adaptiveSize: 216 },
  { name: 'xxhdpi', iconSize: 144, adaptiveSize: 324 },
  { name: 'xxxhdpi', iconSize: 192, adaptiveSize: 432 },
];

const splashDensities = [
  { name: 'mdpi', size: 288 },
  { name: 'hdpi', size: 432 },
  { name: 'xhdpi', size: 576 },
  { name: 'xxhdpi', size: 864 },
  { name: 'xxxhdpi', size: 1152 },
];

function hexColor(hex) {
  const value = hex.replace('#', '');
  return {
    red: parseInt(value.slice(0, 2), 16),
    green: parseInt(value.slice(2, 4), 16),
    blue: parseInt(value.slice(4, 6), 16),
    alpha: 255,
  };
}

function withAlpha(color, alpha) {
  return { ...color, alpha };
}

function mixColor(firstColor, secondColor, amount) {
  const clampedAmount = Math.max(0, Math.min(1, amount));
  return {
    red: Math.round(firstColor.red + (secondColor.red - firstColor.red) * clampedAmount),
    green: Math.round(firstColor.green + (secondColor.green - firstColor.green) * clampedAmount),
    blue: Math.round(firstColor.blue + (secondColor.blue - firstColor.blue) * clampedAmount),
    alpha: Math.round(firstColor.alpha + (secondColor.alpha - firstColor.alpha) * clampedAmount),
  };
}

function createSurface(width, height, transparent = false) {
  const scale = Math.max(width, height) >= 864 ? 2 : 3;
  const surface = new PNG({ width: width * scale, height: height * scale });
  if (!transparent) {
    paintBackground(surface);
  }
  return { image: surface, scale, width, height };
}

function paintBackground(image) {
  const width = image.width;
  const height = image.height;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const diagonalAmount = (x / Math.max(1, width - 1)) * 0.66 + (y / Math.max(1, height - 1)) * 0.34;
      let pixelColor = mixColor(colors.teal, colors.blue, diagonalAmount);

      const mintDistance = Math.hypot((x / width) - 0.22, (y / height) - 0.20);
      const mintAmount = Math.max(0, 1 - mintDistance / 0.58) * 0.24;
      pixelColor = mixColor(pixelColor, colors.mint, mintAmount);

      const coralDistance = Math.hypot((x / width) - 0.88, (y / height) - 0.86);
      const coralAmount = Math.max(0, 1 - coralDistance / 0.52) * 0.22;
      pixelColor = mixColor(pixelColor, colors.coral, coralAmount);

      writePixel(image, x, y, pixelColor);
    }
  }
}

function writePixel(image, x, y, color) {
  const index = (image.width * y + x) << 2;
  image.data[index] = color.red;
  image.data[index + 1] = color.green;
  image.data[index + 2] = color.blue;
  image.data[index + 3] = color.alpha;
}

function blendPixel(image, x, y, color) {
  if (x < 0 || y < 0 || x >= image.width || y >= image.height || color.alpha <= 0) {
    return;
  }

  const index = (image.width * y + x) << 2;
  const sourceAlpha = color.alpha / 255;
  const destinationAlpha = image.data[index + 3] / 255;
  const outputAlpha = sourceAlpha + destinationAlpha * (1 - sourceAlpha);

  if (outputAlpha <= 0) {
    return;
  }

  image.data[index] = Math.round((color.red * sourceAlpha + image.data[index] * destinationAlpha * (1 - sourceAlpha)) / outputAlpha);
  image.data[index + 1] = Math.round((color.green * sourceAlpha + image.data[index + 1] * destinationAlpha * (1 - sourceAlpha)) / outputAlpha);
  image.data[index + 2] = Math.round((color.blue * sourceAlpha + image.data[index + 2] * destinationAlpha * (1 - sourceAlpha)) / outputAlpha);
  image.data[index + 3] = Math.round(outputAlpha * 255);
}

function drawCircle(surface, centerX, centerY, radius, color) {
  const image = surface.image;
  const scale = surface.scale;
  const scaledCenterX = centerX * image.width;
  const scaledCenterY = centerY * image.height;
  const scaledRadius = radius * Math.min(image.width, image.height);
  const minimumX = Math.max(0, Math.floor(scaledCenterX - scaledRadius));
  const maximumX = Math.min(image.width - 1, Math.ceil(scaledCenterX + scaledRadius));
  const minimumY = Math.max(0, Math.floor(scaledCenterY - scaledRadius));
  const maximumY = Math.min(image.height - 1, Math.ceil(scaledCenterY + scaledRadius));

  for (let y = minimumY; y <= maximumY; y += 1) {
    for (let x = minimumX; x <= maximumX; x += 1) {
      const distance = Math.hypot(x - scaledCenterX, y - scaledCenterY);
      if (distance <= scaledRadius) {
        blendPixel(image, x, y, color);
      }
    }
  }
}

function drawCircleStroke(surface, centerX, centerY, radius, strokeWidth, color) {
  const segments = 180;
  const points = [];
  for (let index = 0; index <= segments; index += 1) {
    const angle = (Math.PI * 2 * index) / segments;
    points.push([centerX + Math.cos(angle) * radius, centerY + Math.sin(angle) * radius]);
  }
  drawPolyline(surface, points, strokeWidth / 2, color);
}

function drawEllipse(surface, centerX, centerY, radiusX, radiusY, rotation, color) {
  const image = surface.image;
  const scaledCenterX = centerX * image.width;
  const scaledCenterY = centerY * image.height;
  const scaledRadiusX = radiusX * image.width;
  const scaledRadiusY = radiusY * image.height;
  const padding = Math.max(scaledRadiusX, scaledRadiusY);
  const minimumX = Math.max(0, Math.floor(scaledCenterX - padding));
  const maximumX = Math.min(image.width - 1, Math.ceil(scaledCenterX + padding));
  const minimumY = Math.max(0, Math.floor(scaledCenterY - padding));
  const maximumY = Math.min(image.height - 1, Math.ceil(scaledCenterY + padding));
  const cosine = Math.cos(rotation);
  const sine = Math.sin(rotation);

  for (let y = minimumY; y <= maximumY; y += 1) {
    for (let x = minimumX; x <= maximumX; x += 1) {
      const translatedX = x - scaledCenterX;
      const translatedY = y - scaledCenterY;
      const localX = translatedX * cosine + translatedY * sine;
      const localY = -translatedX * sine + translatedY * cosine;
      const ellipseValue = (localX * localX) / (scaledRadiusX * scaledRadiusX) + (localY * localY) / (scaledRadiusY * scaledRadiusY);
      if (ellipseValue <= 1) {
        blendPixel(image, x, y, color);
      }
    }
  }
}

function drawPolyline(surface, points, radius, color) {
  for (let index = 0; index < points.length - 1; index += 1) {
    drawCapsule(surface, points[index], points[index + 1], radius, color);
  }
}

function drawCapsule(surface, firstPoint, secondPoint, radius, color) {
  const image = surface.image;
  const scaledRadius = radius * Math.min(image.width, image.height);
  const x1 = firstPoint[0] * image.width;
  const y1 = firstPoint[1] * image.height;
  const x2 = secondPoint[0] * image.width;
  const y2 = secondPoint[1] * image.height;
  const minimumX = Math.max(0, Math.floor(Math.min(x1, x2) - scaledRadius));
  const maximumX = Math.min(image.width - 1, Math.ceil(Math.max(x1, x2) + scaledRadius));
  const minimumY = Math.max(0, Math.floor(Math.min(y1, y2) - scaledRadius));
  const maximumY = Math.min(image.height - 1, Math.ceil(Math.max(y1, y2) + scaledRadius));
  const segmentLengthSquared = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);

  for (let y = minimumY; y <= maximumY; y += 1) {
    for (let x = minimumX; x <= maximumX; x += 1) {
      let amount = 0;
      if (segmentLengthSquared > 0) {
        amount = ((x - x1) * (x2 - x1) + (y - y1) * (y2 - y1)) / segmentLengthSquared;
      }
      const clampedAmount = Math.max(0, Math.min(1, amount));
      const closestX = x1 + (x2 - x1) * clampedAmount;
      const closestY = y1 + (y2 - y1) * clampedAmount;
      if (Math.hypot(x - closestX, y - closestY) <= scaledRadius) {
        blendPixel(image, x, y, color);
      }
    }
  }
}

function cubicPoints(start, controlA, controlB, end, segments) {
  const points = [];
  for (let index = 0; index <= segments; index += 1) {
    const amount = index / segments;
    const inverseAmount = 1 - amount;
    const x = inverseAmount ** 3 * start[0]
      + 3 * inverseAmount * inverseAmount * amount * controlA[0]
      + 3 * inverseAmount * amount * amount * controlB[0]
      + amount ** 3 * end[0];
    const y = inverseAmount ** 3 * start[1]
      + 3 * inverseAmount * inverseAmount * amount * controlA[1]
      + 3 * inverseAmount * amount * amount * controlB[1]
      + amount ** 3 * end[1];
    points.push([x, y]);
  }
  return points;
}

function brandPath(offsetY = 0) {
  const firstCurve = cubicPoints([0.22, 0.66 + offsetY], [0.32, 0.53 + offsetY], [0.43, 0.53 + offsetY], [0.50, 0.64 + offsetY], 32);
  const pulse = [
    [0.50, 0.64 + offsetY],
    [0.585, 0.36 + offsetY],
    [0.67, 0.59 + offsetY],
  ];
  const lastCurve = cubicPoints([0.67, 0.59 + offsetY], [0.71, 0.54 + offsetY], [0.74, 0.47 + offsetY], [0.79, 0.43 + offsetY], 24);
  return [...firstCurve, ...pulse, ...lastCurve];
}

function drawMark(surface, mode = 'color') {
  const isMonochrome = mode === 'monochrome';
  const markColor = isMonochrome ? colors.monochrome : colors.white;
  const accentA = isMonochrome ? colors.monochrome : colors.coral;
  const accentB = isMonochrome ? colors.monochrome : colors.mint;

  if (mode === 'full') {
    drawCircleStroke(surface, 0.50, 0.53, 0.36, 0.012, withAlpha(colors.white, 28));
    drawCircleStroke(surface, 0.54, 0.49, 0.24, 0.009, withAlpha(colors.white, 24));
    drawCircle(surface, 0.86, 0.18, 0.065, withAlpha(colors.coral, 44));
  }

  drawPolyline(surface, brandPath(0.018), 0.058, withAlpha(colors.shadow, isMonochrome ? 0 : 75));
  drawPolyline(surface, brandPath(), 0.047, withAlpha(markColor, 250));
  drawPolyline(surface, brandPath(), 0.025, withAlpha(colors.white, isMonochrome ? 0 : 64));

  drawCircle(surface, 0.22, 0.66, 0.062, withAlpha(colors.shadow, isMonochrome ? 0 : 45));
  drawCircle(surface, 0.22, 0.66, 0.048, withAlpha(accentA, 255));
  drawCircle(surface, 0.22, 0.66, 0.020, withAlpha(colors.white, isMonochrome ? 0 : 135));

  drawCircle(surface, 0.79, 0.43, 0.058, withAlpha(colors.shadow, isMonochrome ? 0 : 42));
  drawCircle(surface, 0.79, 0.43, 0.044, withAlpha(accentB, 255));
  drawCircle(surface, 0.79, 0.43, 0.018, withAlpha(colors.white, isMonochrome ? 0 : 118));

  drawEllipse(surface, 0.40, 0.78, 0.050, 0.022, -0.45, withAlpha(markColor, 118));
  drawEllipse(surface, 0.58, 0.22, 0.044, 0.020, 0.58, withAlpha(markColor, 106));
}

function downsample(surface) {
  const output = new PNG({ width: surface.width, height: surface.height });
  const scale = surface.scale;

  for (let y = 0; y < output.height; y += 1) {
    for (let x = 0; x < output.width; x += 1) {
      let alphaSum = 0;
      let redSum = 0;
      let greenSum = 0;
      let blueSum = 0;

      for (let scaledY = 0; scaledY < scale; scaledY += 1) {
        for (let scaledX = 0; scaledX < scale; scaledX += 1) {
          const sourceX = x * scale + scaledX;
          const sourceY = y * scale + scaledY;
          const sourceIndex = (surface.image.width * sourceY + sourceX) << 2;
          const sourceAlpha = surface.image.data[sourceIndex + 3] / 255;
          alphaSum += sourceAlpha;
          redSum += surface.image.data[sourceIndex] * sourceAlpha;
          greenSum += surface.image.data[sourceIndex + 1] * sourceAlpha;
          blueSum += surface.image.data[sourceIndex + 2] * sourceAlpha;
        }
      }

      const sampleCount = scale * scale;
      const outputAlpha = alphaSum / sampleCount;
      const outputIndex = (output.width * y + x) << 2;
      output.data[outputIndex + 3] = Math.round(outputAlpha * 255);

      if (alphaSum > 0) {
        output.data[outputIndex] = Math.round(redSum / alphaSum);
        output.data[outputIndex + 1] = Math.round(greenSum / alphaSum);
        output.data[outputIndex + 2] = Math.round(blueSum / alphaSum);
      }
    }
  }

  return output;
}

function writePng(relativePath, png) {
  const outputPath = path.join(projectRoot, relativePath);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, PNG.sync.write(png));
}

function renderIcon(size) {
  const surface = createSurface(size, size, false);
  drawMark(surface, 'full');
  return downsample(surface);
}

function renderBackground(size) {
  const surface = createSurface(size, size, false);
  return downsample(surface);
}

function renderForeground(size) {
  const surface = createSurface(size, size, true);
  drawMark(surface, 'color');
  return downsample(surface);
}

function renderMonochrome(size) {
  const surface = createSurface(size, size, true);
  drawMark(surface, 'monochrome');
  return downsample(surface);
}

function removeGeneratedWebpResources() {
  for (const density of launcherDensities) {
    const densityDirectory = path.join(projectRoot, 'android', 'app', 'src', 'main', 'res', `mipmap-${density.name}`);
    const webpFiles = [
      'ic_launcher.webp',
      'ic_launcher_round.webp',
      'ic_launcher_background.webp',
      'ic_launcher_foreground.webp',
      'ic_launcher_monochrome.webp',
    ];
    for (const webpFile of webpFiles) {
      const webpPath = path.join(densityDirectory, webpFile);
      if (fs.existsSync(webpPath)) {
        fs.rmSync(webpPath);
      }
    }
  }
}

function main() {
  writePng('assets/icon.png', renderIcon(1024));
  writePng('assets/splash-icon.png', renderIcon(1024));
  writePng('assets/android-icon-background.png', renderBackground(512));
  writePng('assets/android-icon-foreground.png', renderForeground(512));
  writePng('assets/android-icon-monochrome.png', renderMonochrome(432));
  writePng('assets/favicon.png', renderIcon(48));

  removeGeneratedWebpResources();

  for (const density of launcherDensities) {
    const resourceDirectory = `android/app/src/main/res/mipmap-${density.name}`;
    writePng(`${resourceDirectory}/ic_launcher.png`, renderIcon(density.iconSize));
    writePng(`${resourceDirectory}/ic_launcher_round.png`, renderIcon(density.iconSize));
    writePng(`${resourceDirectory}/ic_launcher_background.png`, renderBackground(density.adaptiveSize));
    writePng(`${resourceDirectory}/ic_launcher_foreground.png`, renderForeground(density.adaptiveSize));
    writePng(`${resourceDirectory}/ic_launcher_monochrome.png`, renderMonochrome(density.adaptiveSize));
  }

  for (const density of splashDensities) {
    writePng(`android/app/src/main/res/drawable-${density.name}/splashscreen_logo.png`, renderIcon(density.size));
  }
}

main();
