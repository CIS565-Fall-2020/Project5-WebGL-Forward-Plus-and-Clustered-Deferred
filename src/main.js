import { makeRenderLoop, camera, cameraControls, gui, gl } from './init';
import ForwardRenderer from './renderers/forward';
import ForwardPlusRenderer from './renderers/forwardPlus';
import ClusteredDeferredRenderer from './renderers/clusteredDeferred';
import Scene from './scene';
import Wireframe from './wireframe';

const FORWARD = 'Forward';
const FORWARD_PLUS = 'Forward+';
const CLUSTERED = 'Clustered Deferred';

const params = {
  renderer: FORWARD_PLUS,
  _renderer: null,
};

setRenderer(params.renderer);

function setRenderer(renderer) {
  switch(renderer) {
    case FORWARD:
      params._renderer = new ForwardRenderer();
      break;
    case FORWARD_PLUS:
      params._renderer = new ForwardPlusRenderer(15, 15, 15);
      break;
    case CLUSTERED:
      params._renderer = new ClusteredDeferredRenderer(15, 15, 15);
      break;
  }
}

gui.add(params, 'renderer', [FORWARD, FORWARD_PLUS, CLUSTERED]).onChange(setRenderer);

const scene = new Scene();
scene.loadGLTF('models/sponza/sponza.gltf');

// LOOK: The Wireframe class is for debugging.
// It lets you draw arbitrary lines in the scene.
// This may be helpful for visualizing your frustum clusters so you can make
// sure that they are in the right place.
const wireframe = new Wireframe();

var segmentStart = [-14.0, 0.0, -6.0];
var segmentEnd = [14.0, 20.0, 6.0];
var segmentColor = [1.0, 0.0, 0.0];
// wireframe.addLineSegment(segmentStart, segmentEnd, segmentColor);
// wireframe.addLineSegment([-14.0, 1.0, -6.0], [14.0, 21.0, 6.0], [0.0, 1.0, 0.0]);

// xyz axes
wireframe.addLineSegment([0.0, 0.0, 0.0], [5.0, 0.0, 0.0], [1.0, 0.0, 0.0]);
wireframe.addLineSegment([0.0, 0.0, 0.0], [0.0, 5.0, 0.0], [0.0, 1.0, 0.0]);
wireframe.addLineSegment([0.0, 0.0, 0.0], [0.0, 0.0, 5.0], [0.0, 0.0, 1.0]);

// frustum bounds
let far = camera.far / 100.0;
let near = camera.near;
let aspectRatio = camera.aspect;
let vFOV = camera.fov * Math.PI / 180.0;
let hFOV = 2.0 * Math.atan((aspectRatio * far * Math.tan(vFOV / 2.0)) / far);
wireframe.addLineSegment([0.0, 0.0, 0.0], [-Math.tan(hFOV / 2.0) * far, 0.0, far], [1.0, 1.0, 1.0]);
wireframe.addLineSegment([0.0, 0.0, 0.0], [Math.tan(hFOV / 2.0) * far, 0.0, far], [1.0, 1.0, 1.0]);
wireframe.addLineSegment([Math.tan(hFOV / 2.0) * far, 0.0, far], [-Math.tan(hFOV / 2.0) * far, 0.0, far], [1.0, 1.0, 1.0]);

let zSliceThickness = (far - near) / 15;
// sub-frustums
for (let z = 0; z < 15; ++z) {
  for (let y = 0; y < 15; ++y) {
    for (let x = 0; x < 15; ++x) {
      let i = x + y * this._xSlices + z * this._xSlices * this._ySlices;
      let iFrontPlaneDist = z * zSliceThickness + near;
      wireframe.addLineSegment([-Math.tan(hFOV / 2.0) * iFrontPlaneDist, 0.0, Math.tan(hFOV / 2.0) * iFrontPlaneDist], [iFrontPlaneDist, 0.0, iFrontPlaneDist], [1.0, 1.0, 1.0]);
    }
  }
}



camera.position.set(-10, 8, 0);
cameraControls.target.set(0, 2, 0);
gl.enable(gl.DEPTH_TEST);

function render() {
  scene.update();  
  params._renderer.render(camera, scene);

  // LOOK: Render wireframe "in front" of everything else.
  // If you would like the wireframe to render behind and in front
  // of objects based on relative depths in the scene, comment out /
  //the gl.disable(gl.DEPTH_TEST) and gl.enable(gl.DEPTH_TEST) lines.
  gl.disable(gl.DEPTH_TEST);
  wireframe.render(camera);
  gl.enable(gl.DEPTH_TEST);
}

makeRenderLoop(render)();