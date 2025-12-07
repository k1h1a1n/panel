const http = require('http');
const path = require('path');
const fs = require('fs-extra');
const axios = require('axios');
const AdmZip = require('adm-zip');
const archiver = require('archiver');
const { exec } = require('child_process');
const imageminModule = require('imagemin');
const imageminPngquantModule = require('imagemin-pngquant');
const imageminMozjpegModule = require('imagemin-mozjpeg');
const { DOMParser, XMLSerializer } = require('xmldom');

const imagemin = imageminModule?.default || imageminModule;
const imageminPngquant = imageminPngquantModule?.default || imageminPngquantModule;
const imageminMozjpeg = imageminMozjpegModule?.default || imageminMozjpegModule;

const PORT = process.env.PORT || 4300;
const PROJECT_ROOT = path.join(__dirname, '..');
const DOWNLOAD_DIR = path.join(PROJECT_ROOT, 'downloads');
const PROCESSED_DIR = path.join(DOWNLOAD_DIR, 'processed_files');
const OUTPUT_DIR = path.join(PROCESSED_DIR, 'output');

fs.ensureDirSync(DOWNLOAD_DIR);
fs.ensureDirSync(PROCESSED_DIR);
fs.ensureDirSync(OUTPUT_DIR);

const TARGET_IMAGE_SIZE_BYTES = 150 * 1024; // 150 KB cap per image
const PNG_QUALITY_STEPS = [
  [0.7, 0.9],
  [0.55, 0.75],
  [0.4, 0.6],
  [0.25, 0.45],
];
const JPEG_QUALITY_STEPS = [95, 85, 75, 65, 55];

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'OPTIONS, GET, POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === 'GET' && req.url.startsWith('/files/')) {
    return serveOutputFile(req, res);
  }

  if (req.method !== 'POST' || req.url !== '/download-image') {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, message: 'Not found' }));
    return;
  }

  let body = '';
  req.on('data', (chunk) => (body += chunk));
  req.on('end', async () => {
    try {
      const payload = JSON.parse(body || '{}');
      if (!payload.link) {
        respondJson(res, 400, { success: false, message: 'link is required' });
        return;
      }

      const result = await processPayload(payload);
      respondJson(res, 200, { success: true, ...result });
    } catch (error) {
      console.error('Processing error', error);
      respondJson(res, 500, { success: false, message: error.message || 'Processing failed' });
    }
  });
});

server.listen(PORT, () => {
  console.log(`Sync download server listening on http://localhost:${PORT}`);
});

async function processPayload(payload) {
  const convertedUrl = convertUrl(payload.link);
  const fileName = path.basename(new URL(convertedUrl).pathname);
  const downloadPath = path.join(DOWNLOAD_DIR, fileName);

  await downloadFile(convertedUrl, downloadPath);

  const { folderName, processedFolder } = await extractAndProcess(downloadPath, payload);
  const { zipPath, previewPath } = await zipFolder(folderName, processedFolder);

  return { folderName, zipPath, previewPath };
}

async function downloadFile(url, outputPath) {
  const response = await axios({ method: 'GET', url, responseType: 'stream' });
  await fs.ensureDir(path.dirname(outputPath));
  const writer = fs.createWriteStream(outputPath);
  response.data.pipe(writer);
  await new Promise((resolve, reject) => {
    writer.on('finish', resolve);
    writer.on('error', reject);
  });
}

async function extractAndProcess(originalFilePath, payload) {
  const zipPath = originalFilePath.replace(/\.CRDesign$/i, '.zip');
  await fs.move(originalFilePath, zipPath, { overwrite: true });

  const extractPath = zipPath.replace(/\.zip$/i, '');
  const zip = new AdmZip(zipPath);
  zip.extractAllTo(extractPath, true);

  renameFilesRecursively(extractPath);

  const folderName = sanitizeName(payload.imgNo || payload.id || path.basename(extractPath).slice(-4));
  const processedFolder = path.join(PROCESSED_DIR, folderName);
  await fs.ensureDir(processedFolder);
  await fs.emptyDir(processedFolder);

  const filesToMove = findFilesRecursively(extractPath);

  for (const file of filesToMove) {
    const extension = path.extname(file).toLowerCase();
    let targetName;

    if (extension === '.svg') {
      targetName = 'current.svg';
    } else if (extension === '.prib') {
      targetName = 'preview.png';
    } else {
      continue;
    }

    const destination = path.join(processedFolder, targetName);
    await fs.copy(file, destination, { overwrite: true });

    if (extension === '.svg') {
      const svgString = await fs.readFile(destination, 'utf8');
      const background = await setBackgroundImage(svgString, extractPath, '');
      await convertSvgToPng(
        background.svg,
        background.width,
        background.height,
        path.join(processedFolder, 'background.png')
      );
      const updatedSvg = updateSvgTextTag(svgString);
      const finalSvg = await createFinalSvg(updatedSvg);
      await fs.writeFile(destination, finalSvg, 'utf8');
    }
  }

  await optimizeProcessedFolder(processedFolder);

  await fs.remove(extractPath);
  await fs.remove(zipPath);

  return { folderName, processedFolder };
}

function findFilesRecursively(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...findFilesRecursively(fullPath));
    } else if (['.prib', '.svg'].includes(path.extname(entry.name).toLowerCase())) {
      files.push(fullPath);
    }
  }

  return files;
}

function renameFilesRecursively(folderPath) {
  fs.readdirSync(folderPath).forEach((file) => {
    const oldFilePath = path.join(folderPath, file);
    const stats = fs.lstatSync(oldFilePath);

    if (stats.isDirectory()) {
      renameFilesRecursively(oldFilePath);
    } else {
      const newFileName = file
        .replace(/\.dgpng$/i, '.png')
        .replace(/\.dgjpg$/i, '.jpg')
        .replace(/\.dg/gi, '.');
      const newFilePath = path.join(folderPath, newFileName);
      if (oldFilePath !== newFilePath) {
        fs.renameSync(oldFilePath, newFilePath);
      }
    }
  });
}

function convertUrl(inputUrl) {
  const newBaseUrl = 'https://design.instrasoftsolutions.in';
  let updatedUrl = inputUrl.replace('https://design.instrasoftsolutions.in', newBaseUrl);
  updatedUrl = updatedUrl.replace(/\-p(?=\.\w+$)/, '');
  updatedUrl = updatedUrl.replace(/\.\w+$/, '');
  return `${updatedUrl}.CRDesign`;
}

function sanitizeName(name) {
  return (name || 'design').toString().replace(/[^a-zA-Z0-9_-]/g, '').slice(-20) || 'design';
}

function respondJson(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
}

async function convertSvgToPng(svgString, width, height, outputPath) {
  if (!svgString) return;
  await fs.ensureDir(path.dirname(outputPath));
  const tempFile = path.join(DOWNLOAD_DIR, `temp-${Date.now()}-${Math.random().toString(36).slice(2)}.svg`);
  await fs.writeFile(tempFile, svgString, 'utf8');

  const command = `svgexport "${tempFile}" "${outputPath}" ${width}:${height}`;
  await new Promise((resolve, reject) => {
    exec(command, (error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });

  await fs.remove(tempFile);
}

async function setBackgroundImage(svgString, newFolderPath) {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(svgString, 'image/svg+xml');
  const imageTags = xmlDoc.getElementsByTagName('image');

  let finalSvgContent = '';
  let widthBackground = null;
  let heightBackground = null;

  for (let i = 0; i < imageTags.length; i++) {
    const tag = imageTags[i];
    const type = tag.getAttribute('Dg_type');
    if (type !== 'DgBackGround' && type !== 'DgClipart') {
      continue;
    }

    if (type === 'DgBackGround') {
      widthBackground = tag.getAttribute('width') || '0';
      heightBackground = tag.getAttribute('height') || '0';
    }

    const width = tag.getAttribute('width') || '0';
    const height = tag.getAttribute('height') || '0';
    const x = tag.getAttribute('x') || '0';
    const y = tag.getAttribute('y') || '0';
    const angle = tag.getAttribute('DgAngleZ') || '0';
    const cx = parseFloat(x) + parseFloat(width) / 2;
    const cy = parseFloat(y) + parseFloat(height) / 2;

    const src = tag.getAttribute('xlink:href') || tag.getAttribute('href') || '';
    if (!src) continue;

    const fileName = path.basename(src);
    const updatedPath = findFileInFolder(newFolderPath, fileName);
    if (!updatedPath) continue;

    const base64Image = convertImageToBase64(updatedPath);
    finalSvgContent += `<image href="${base64Image}" x="${x}" y="${y}" width="${width}" height="${height}" transform="rotate(${angle}, ${cx}, ${cy})" />\n`;
  }

  const finalSvg = `<svg xmlns="http://www.w3.org/2000/svg">${finalSvgContent}</svg>`;
  return {
    svg: finalSvg,
    width: parseInt(widthBackground || '0', 10) || 0,
    height: parseInt(heightBackground || '0', 10) || 0,
  };
}

function findFileInFolder(folderPath, fileName) {
  const files = fs.readdirSync(folderPath, { withFileTypes: true });
  for (const file of files) {
    const fullPath = path.join(folderPath, file.name);
    if (file.isDirectory()) {
      const found = findFileInFolder(fullPath, fileName);
      if (found) return found;
    } else if (file.name === fileName) {
      return fullPath;
    }
  }
  return null;
}

function convertImageToBase64(filePath) {
  const imageBuffer = fs.readFileSync(filePath);
  return `data:image/jpeg;base64,${imageBuffer.toString('base64')}`;
}

function findNonNegativeTextFields(svgString) {
  const regex = /<text[^>]*x="([0-9]*[.])?[0-9]+"[^>]*y="([0-9]*[.])?[0-9]+"[^>]*>/g;
  const matches = svgString.match(regex);
  return (
    matches?.filter((text) => {
      const xMatch = text.match(/x="([0-9]*[.])?[0-9]+"/);
      const yMatch = text.match(/y="([0-9]*[.])?[0-9]+"/);
      if (!xMatch || !yMatch) return false;
      const xValue = parseFloat(xMatch[1] || '0');
      const yValue = parseFloat(yMatch[1] || '0');
      return xValue >= 0 && yValue >= 0;
    }) || []
  );
}

function convertToSupportedSVGText(textString) {
  const xMatch = textString.match(/x="([0-9]+(?:\.[0-9]+)?)"/);
  const yMatch = textString.match(/y="([0-9]+(?:\.[0-9]+)?)"/);
  const widthMatch = textString.match(/width="([0-9]+(?:\.[0-9]+)?)"/);
  const heightMatch = textString.match(/height="([0-9]+(?:\.[0-9]+)?)"/);
  const textContentMatch = textString.match(/Text="([^"]*)"/);
  const fillColorMatch = textString.match(/DgTitleColor="#([^"]*)"/);
  const fontSizeMatch = textString.match(/DgTitlePointSize="([0-9]+)"/);
  const fontFamilyMatch = textString.match(/DgTitleFamily="([^"]*)"/);
  const fontWeightMatch = textString.match(/DgTitleBold="([0-1])"/);
  const fontStyleMatch = textString.match(/DgTitleItalic="([0-1])"/);

  let textContent = textContentMatch ? textContentMatch[1] : '';
  let lines = textContent?.split('&#10;');
  textContent = assignTextFromSetting(textContent);
  if (lines.length === 1) lines[0] = textContent.text;

  const fontSize = fontSizeMatch ? parseFloat(fontSizeMatch[1]) : 16;
  const heightValue = heightMatch ? parseFloat(heightMatch[1]) : 0;
  const lineHeight = lines.length > 0 ? heightValue / lines.length : heightValue;
  const lastLineHasDash = lines[lines.length - 1]?.includes('-');
  const useMiddle = (textContent.id === 'toName' || textContent.id === 'editableText') && !lastLineHasDash;

  return `
  <text 
    id="${textContent.id}" 
    x="${xMatch ? xMatch[1] : '0'}" 
    y="${yMatch ? yMatch[1] : '0'}" 
    width="${widthMatch ? widthMatch[1] : '0'}" 
    height="${heightMatch ? heightMatch[1] : '0'}"
    font-family="${fontFamilyMatch ? fontFamilyMatch[1] : 'Arial'}" 
    font-size="${fontSize}" 
    font-weight="${fontWeightMatch && fontWeightMatch[1] === '1' ? 'bold' : 'normal'}" 
    font-style="${fontStyleMatch && fontStyleMatch[1] === '1' ? 'italic' : 'normal'}" 
    fill="#${fillColorMatch ? fillColorMatch[1] : '000000'}"
    ${useMiddle ? 'text-anchor="middle"' : ''}
  >
    ${lines
      .map(
        (line, index) =>
          `<tspan 
             x="${useMiddle ? '50%' : xMatch ? xMatch[1] : '0'}" 
             dy="${index === 0 ? parseFloat(lineHeight) + 1 : lineHeight}"
           >${line}</tspan>`
      )
      .join('\n')}
  </text>`;
}

function assignTextFromSetting(text) {
  const removeToName = ['Rohit Jahagirdar'];
  const checkNames = ['Leena Khanolkar', 'Mina Dalal', 'Mina Desai', 'Mansi Desai'];
  const checkCompNames = ['DgFlick Insurance', 'Instrasoft Solutions'];
  const urlPattern = /(?:https?:\/\/)?(?:www\.)?[^\s]+\.[^\s]+/;
  const designations = [
    'Chief Operating Officer',
    'Chief Marketing Officer',
    'Chief Maketing Officer',
    'Chief marketing Manager',
    'Chief Marketing Manager',
    'Manager',
  ];
  const phonePattern = /^(?:\+91)?(?:\d{10})(?:\s*\/\s*\d{10})?$/;

  let result = { id: '', text: '' };

  if (checkNames.includes(text)) {
    result.id = 'selfName';
    result.text = 'Khan Afzal';
  } else if (checkCompNames.includes(text)) {
    result.id = 'companyName';
    result.text = 'Datacomp Web Technologies Pvt. Ltd.';
  } else if (urlPattern.test(text)) {
    result.id = 'website';
    result.text = 'www.webmail.datacomp.in';
  } else if (designations.includes(text)) {
    result.id = 'designation';
    result.text = 'Software Developer';
  } else if (phonePattern.test(text)) {
    result.id = 'selfPhone';
    result.text = '8692979117';
  } else if (removeToName.includes(text)) {
    result.id = 'toName';
    result.text = 'Rohit Jahagirdar';
  } else {
    result.id = 'editableText';
    result.text = text;
  }

  return result;
}

function updateSvgTextTag(svgString) {
  const textFields = findNonNegativeTextFields(svgString);
  let updatedSvgString = svgString;

  for (const field of textFields) {
    const updatedField = convertToSupportedSVGText(field);
    updatedSvgString = updatedSvgString.replace(field, updatedField);
  }

  const regexTitle = /<text[^>]*Dg_type="DgTitle"[^>]*>/g;
  const matches = svgString.match(regexTitle);

  for (const field of matches || []) {
    updatedSvgString = updatedSvgString.replace(field, '');
  }
  return updatedSvgString;
}

async function createFinalSvg(svgString) {
  const parser = new DOMParser();
  const svgDoc = parser.parseFromString(svgString, 'image/svg+xml');
  const svgElement = svgDoc.documentElement;

  const width = svgElement.getAttribute('width') || '0';
  const height = svgElement.getAttribute('height') || '0';

  const imageTags = svgDoc.getElementsByTagName('image');
  let logoImageTag = null;
  let profileImageTag = null;
  for (let i = 0; i < imageTags.length; i++) {
    const image = imageTags[i];
    const dgType = image.getAttribute('Dg_type');
    const xlinkHref = image.getAttribute('xlink:href');
    if (dgType === 'DgPhoto') {
      profileImageTag = image;
    }
    if (dgType === 'DgClipart' && xlinkHref) {
      const clipartIndex = xlinkHref.indexOf('Clipart/');
      if (clipartIndex !== -1) {
        const afterClipart = xlinkHref.substring(clipartIndex + 8);
        if (afterClipart.includes('/')) {
          logoImageTag = image;
        }
      }
    }
  }

  let logoX = '0', logoY = '0', logoH = '0', logoW = '0';
  if (logoImageTag) {
    logoX = logoImageTag.getAttribute('x') || '0';
    logoY = logoImageTag.getAttribute('y') || '0';
    logoH = logoImageTag.getAttribute('height') || '0';
    logoW = logoImageTag.getAttribute('width') || '0';
  }

  let profileX = '0', profileY = '0', profileH = '0', profileW = '0', cx = 0, cy = 0, r = 0;
  if (profileImageTag) {
    profileX = profileImageTag.getAttribute('x') || '0';
    profileY = profileImageTag.getAttribute('y') || '0';
    profileH = profileImageTag.getAttribute('height') || '0';
    profileW = profileImageTag.getAttribute('width') || '0';
    r = parseFloat(profileW) / 2;
    cx = parseFloat(profileX) + r;
    cy = parseFloat(profileY) + r;
  }

  const textTags = svgDoc.getElementsByTagName('text');
  const serializer = new XMLSerializer();
  let textElements = '';
  for (let i = 0; i < textTags.length; i++) {
    textElements += serializer.serializeToString(textTags[i]) + '\n';
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <image href="background.png" x="0" y="0" />
  <image x="${logoX}" y="${logoY}" width="${logoW}" height="${logoH}" href="logo.png" />
  <defs>
    <mask id="myMask">
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="white" />
    </mask>
  </defs>

  <image
    href="profile.png"
    x="${profileX}"
    y="${profileY}"
    width="${profileW}"
    height="${profileH}"
    mask="url(#myMask)"
  />
  ${textElements}
  </svg>`;
}

async function zipFolder(folderName, processedFolderPath) {
  const folderPath = processedFolderPath || path.join(PROCESSED_DIR, folderName);
  const zipFolderPath = path.join(OUTPUT_DIR, folderName);
  const zipFilePath = path.join(zipFolderPath, `${folderName}.zip`);

  await fs.ensureDir(zipFolderPath);

  const previewSource = path.join(folderPath, 'preview.png');
  const previewDestination = path.join(zipFolderPath, 'preview.png');

  await new Promise((resolve, reject) => {
    const output = fs.createWriteStream(zipFilePath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', resolve);
    archive.on('error', reject);

    archive.pipe(output);
    archive.directory(folderPath, false);
    archive.finalize();
  });

  if (await fs.pathExists(previewSource)) {
    await fs.copy(previewSource, previewDestination, { overwrite: true });
  } else {
    console.warn(`   Warning: preview.png missing in ${folderPath}, nothing to copy to output folder`);
  }

  return { zipPath: zipFilePath, previewPath: previewDestination };
}

async function optimizeProcessedFolder(folderPath) {
  const allFiles = collectAllFiles(folderPath);
  console.log(`   Optimizing ${allFiles.length} assets in ${path.basename(folderPath)}`);

  for (const file of allFiles) {
    await compressImage(file);
  }

  const previewSrc = allFiles.find((f) => path.basename(f).toLowerCase() === 'preview.png');
  if (!previewSrc) {
    console.warn(`   Warning: preview.png not found under ${folderPath}`);
  }
}

async function compressImage(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (!['.png', '.jpg', '.jpeg'].includes(ext)) {
    return;
  }

  const beforeSize = fs.statSync(filePath).size;
  let afterSize = beforeSize;

  const steps = ext === '.png' ? PNG_QUALITY_STEPS : JPEG_QUALITY_STEPS;

  try {
    for (const quality of steps) {
      const plugins =
        ext === '.png'
          ? [imageminPngquant({ quality, speed: 1 })]
          : [imageminMozjpeg({ quality: quality })];

      await imagemin([filePath], {
        destination: path.dirname(filePath),
        plugins,
      });

      afterSize = fs.statSync(filePath).size;
      if (afterSize <= TARGET_IMAGE_SIZE_BYTES) {
        break;
      }
    }

    const savedKB = ((beforeSize - afterSize) / 1024).toFixed(2);
    const afterKB = (afterSize / 1024).toFixed(1);
    const beforeKB = (beforeSize / 1024).toFixed(1);
    const overTargetNote = afterSize > TARGET_IMAGE_SIZE_BYTES ? ' ⚠️ still above 150KB' : '';

    console.log(
      `   Compressed ${path.basename(filePath)}: ${beforeKB} KB -> ${afterKB} KB (saved ${savedKB} KB)${overTargetNote}`
    );

    if (afterSize > TARGET_IMAGE_SIZE_BYTES) {
      console.warn(
        `   ⚠️ ${path.basename(filePath)} remains ${(afterSize / 1024).toFixed(1)} KB even after max compression`
      );
    }
  } catch (error) {
    console.error(`   ❌ Error compressing ${filePath}:`, error.message);
  }
}

function collectAllFiles(dir, acc = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectAllFiles(fullPath, acc);
    } else {
      acc.push(fullPath);
    }
  }
  return acc;
}

function serveOutputFile(req, res) {
  const relativePath = decodeURIComponent(req.url.replace('/files/', ''));
  const safePath = path.normalize(relativePath).replace(/^\.+/, '');
  const absolutePath = path.join(OUTPUT_DIR, safePath);

  if (!absolutePath.startsWith(OUTPUT_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  if (!fs.existsSync(absolutePath)) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  res.writeHead(200, {
    'Content-Type': getContentType(absolutePath),
    'Content-Disposition': `attachment; filename="${path.basename(absolutePath)}"`,
  });
  fs.createReadStream(absolutePath).pipe(res);
}

function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  return 'application/zip';
}
