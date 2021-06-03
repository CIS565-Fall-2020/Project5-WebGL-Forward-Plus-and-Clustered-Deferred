import { makeRenderLoop, camera, cameraControls, gui, gl } from './init';
import ForwardRenderer from './renderers/forward';
import ForwardPlusRenderer from './renderers/forwardPlus';
import ClusteredDeferredRenderer from './renderers/clusteredDeferred';
import Scene from './scene';
import Wireframe from './wireframe';
import { vec3 } from 'gl-matrix';

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

const wireframe = new Wireframe();
var segmentColor = [1.0, 0.0, 0.0];



function visualizeFrustum(frustum) {
  
}


camera.position.set(-10, 8, 0);
cameraControls.target.set(0, 2, 0);
gl.enable(gl.DEPTH_TEST);

function render() {
  scene.update();  
  params._renderer.render(camera, scene);

  gl.disable(gl.DEPTH_TEST);
  wireframe.render(camera);
  gl.enable(gl.DEPTH_TEST);
}

makeRenderLoop(render)();