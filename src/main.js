import {
	makeRenderLoop, camera, cameraControls,
	FORWARD, FORWARD_PLUS, CLUSTERED, globalParams, gui, gl
} from './init';
import ForwardRenderer from './renderers/forward';
import ForwardPlusRenderer from './renderers/forwardPlus';
import ClusteredDeferredRenderer from './renderers/clusteredDeferred';
import Scene from './scene';
import Wireframe from './wireframe';

setRenderer(globalParams.renderer);

function setRenderer(renderer) {
	switch(renderer) {
		case FORWARD:
			globalParams._renderer = new ForwardRenderer();
			break;
		case FORWARD_PLUS:
			globalParams._renderer = new ForwardPlusRenderer(192, 108, 15);
			break;
		case CLUSTERED:
			globalParams._renderer = new ClusteredDeferredRenderer(48, 27, 16);
			break;
	}
}

gui.add(globalParams, 'renderer', [FORWARD, FORWARD_PLUS, CLUSTERED]).onChange(setRenderer);
gui.add(globalParams, 'updateLights');
gui.add(globalParams, 'debugMode', 0, 5, 1);
gui.add(globalParams, 'debugModeParam', 0, 1);

const scene = new Scene();
scene.loadGLTF('models/sponza/sponza.gltf');

camera.position.set(-10, 8, 0);
cameraControls.target.set(0, 2, 0);
gl.enable(gl.DEPTH_TEST);

function render() {
	if (globalParams.updateLights) {
		scene.update();
	}
	globalParams._renderer.render(camera, scene);
}

makeRenderLoop(render)();
