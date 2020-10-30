import { makeRenderLoop, camera, cameraControls, gui, gl } from './init';
import ForwardRenderer from './renderers/forward';
import ForwardPlusRenderer from './renderers/forwardPlus';
import ClusteredDeferredRenderer from './renderers/clusteredDeferred';
import Scene from './scene';
import Wireframe from './wireframe';
import { NUM_LIGHTS } from './scene';
import { MAX_LIGHTS_PER_CLUSTER } from './scene';

const FORWARD = 'Forward';
const FORWARD_PLUS = 'Forward+';
const CLUSTERED = 'Clustered Deferred';

const Lambertian = 'Lambertian';


const params = {
  renderer: FORWARD_PLUS,
  numLights:NUM_LIGHTS,
  maxLightsPerCluster: MAX_LIGHTS_PER_CLUSTER,
  ShadingModel: Lambertian,
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
wireframe.addLineSegment(segmentStart, segmentEnd, segmentColor);
wireframe.addLineSegment([-14.0, 1.0, -6.0], [14.0, 21.0, 6.0], [0.0, 1.0, 0.0]);

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
  //gl.disable(gl.DEPTH_TEST);
  //wireframe.render(camera);
  //gl.enable(gl.DEPTH_TEST);
}

makeRenderLoop(render)();