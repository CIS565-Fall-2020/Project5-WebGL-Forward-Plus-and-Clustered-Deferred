import { gl } from '../init';
import { mat4, vec4 } from 'gl-matrix';
import { loadShaderProgram } from '../utils';
import { NUM_LIGHTS } from '../scene';
import vsSource from '../shaders/forward/forward.vert.glsl';
import fsSource from '../shaders/forward/forward.frag.glsl.js';
import TextureBuffer from './textureBuffer';

export default class ForwardRenderer {
	constructor() {
		// Initialize a shader program. The fragment shader source is compiled based on the number of lights
		this._shaderProgram = loadShaderProgram(vsSource, fsSource({
			numLights: NUM_LIGHTS,
		}), {
			uniforms: ['u_viewProjectionMatrix', 'u_colmap', 'u_normap'],
			attribs: ['a_position', 'a_normal', 'a_uv'],
		});

		this._projectionMatrix = mat4.create();
		this._viewMatrix = mat4.create();
		this._viewProjectionMatrix = mat4.create();

		this._lightBuffer = gl.createBuffer();
	}

	render(camera, scene) {
		// Update the camera matrices
		camera.updateMatrixWorld();
		mat4.invert(this._viewMatrix, camera.matrixWorld.elements);
		mat4.copy(this._projectionMatrix, camera.projectionMatrix.elements);
		mat4.multiply(this._viewProjectionMatrix, this._projectionMatrix, this._viewMatrix);

		// Update the buffer used to populate the texture packed with light data
		const lightBuffer = new Float32Array(NUM_LIGHTS * 8);
		for (let i = 0, base = 0; i < NUM_LIGHTS; ++i, base += 8) {
			lightBuffer[base + 0] = scene.lights[i].position[0];
			lightBuffer[base + 1] = scene.lights[i].position[1];
			lightBuffer[base + 2] = scene.lights[i].position[2];
			lightBuffer[base + 3] = scene.lights[i].radius;

			lightBuffer[base + 4] = scene.lights[i].color[0];
			lightBuffer[base + 5] = scene.lights[i].color[1];
			lightBuffer[base + 6] = scene.lights[i].color[2];
		}
		gl.bindBuffer(gl.SHADER_STORAGE_BUFFER, this._lightBuffer);
		gl.bufferData(gl.SHADER_STORAGE_BUFFER, lightBuffer, gl.DYNAMIC_DRAW);

		// Bind the default null framebuffer which is the screen
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
		gl.viewport(0, 0, canvas.width, canvas.height);
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

		// Use this shader program
		gl.useProgram(this._shaderProgram.glShaderProgram);

		// Upload the camera matrix
		gl.uniformMatrix4fv(this._shaderProgram.u_viewProjectionMatrix, false, this._viewProjectionMatrix);

		gl.bindBufferBase(gl.SHADER_STORAGE_BUFFER, 0, this._lightBuffer);

		// Draw the scene. This function takes the shader program so that the model's textures can be bound to the right inputs
		scene.draw(this._shaderProgram);
	}
};
