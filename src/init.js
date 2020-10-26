// TODO: Change this to enable / disable debug mode
export const DEBUG = true && process.env.NODE_ENV === 'development';

import DAT from 'dat.gui';
import WebGLDebug from 'webgl-debug';
import Stats from 'stats-js';
import { GeometryIdCount, PerspectiveCamera } from 'three';
import OrbitControls from 'three-orbitcontrols';
import { Spector } from 'spectorjs';

export var ABORTED = false;
export function abort(message) {
  ABORTED = true;
  throw message;
}

// Get the canvas element
export const canvas = document.getElementById('canvas');

// Initialize the WebGL context
const glContext = canvas.getContext('webgl2-compute');
if (!glContext) {
  abort('no gl :(');
}

// Get a debug context
export const gl = DEBUG ? WebGLDebug.makeDebugContext(glContext, (err, funcName, args) => {
  abort(WebGLDebug.glEnumToString(err) + ' was caused by call to: ' + funcName);
}) : glContext;

const supportedExtensions = gl.getSupportedExtensions();
const requiredExtensions = [
  /*'OES_texture_float',
  'OES_texture_float_linear',
  'OES_element_index_uint',
  'WEBGL_draw_buffers',*/
  'EXT_color_buffer_float'
];

// Check that all required extensions are supported
for (let i = 0; i < requiredExtensions.length; ++i) {
  if (supportedExtensions.indexOf(requiredExtensions[i]) < 0) {
    throw 'Unable to load extension ' + requiredExtensions[i];
  }
  gl.getExtension(requiredExtensions[i])
}

export const FORWARD = 'Forward';
export const FORWARD_PLUS = 'Forward+';
export const CLUSTERED = 'Clustered Deferred';

export const globalParams = {
	renderer: CLUSTERED,
  _renderer: null,

	updateLights: true,
  debugMode: 0,
  debugModeParam: 1,
};

export const gui = new DAT.GUI();

// initialize statistics widget
const stats = new Stats();
stats.setMode(1); // 0: fps, 1: ms
stats.domElement.style.position = 'absolute';
stats.domElement.style.left = '0px';
stats.domElement.style.top = '0px';
document.body.appendChild(stats.domElement);

// Initialize camera
export const camera = new PerspectiveCamera(75, canvas.clientWidth / canvas.clientHeight, 0.1, 100);

// Initialize camera controls
export const cameraControls = new OrbitControls(camera, canvas);
cameraControls.enableDamping = true;
cameraControls.enableZoom = true;
cameraControls.rotateSpeed = 0.3;
cameraControls.zoomSpeed = 1.0;
cameraControls.panSpeed = 2.0;

function setSize(width, height) {
  canvas.width = width;
  canvas.height = height;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

setSize(canvas.clientWidth, canvas.clientHeight);
window.addEventListener('resize', () => setSize(canvas.clientWidth, canvas.clientHeight));

if (DEBUG) {
  const spector = new Spector();
  spector.displayUI();
}

// Creates a render loop that is wrapped with camera update and stats logging
export function makeRenderLoop(render) {
  return function tick() {
    cameraControls.update();
    stats.begin();
    render();
    stats.end();
    if (!ABORTED) {
      requestAnimationFrame(tick)
    }
  }
}

// import the main application
require('./main');
