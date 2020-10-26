import { gl, canvas, abort, globalParams } from '../init';
import { mat4, vec4, vec3 } from 'gl-matrix';
import { compileShader, linkShader, addShaderLocations, loadShaderProgram, renderFullscreenQuad } from '../utils';
import { NUM_LIGHTS } from '../scene';
import TextureBuffer from './textureBuffer';
import BaseRenderer from './base';

import depthPrepassVs from "../shaders/forwardPlus/depthPrepass.vert.glsl";
import depthPrepassFs from '../shaders/forwardPlus/depthPrepass.frag.glsl';
import depthPrepassDownsampleFs from '../shaders/forwardPlus/depthDownsampleForwardPlus.frag.glsl'
import cullLightCs from '../shaders/forwardPlus/cullLightsForwardPlus.glsl.js'
import vsSource from '../shaders/forwardPlus/forwardPlus.vert.glsl';
import fsSource from '../shaders/forwardPlus/forwardPlus.frag.glsl.js';
import visualizeDepthFs from '../shaders/forwardPlus/visualizeDepth.frag.glsl.js';

import quadVs from '../shaders/quad.vert.glsl';

const EXPECTED_LIGHTS_PER_TILE = 500;

export default class ForwardPlusRenderer extends BaseRenderer {
	constructor(xSlices, ySlices, zSlices) {
		super(xSlices, ySlices, zSlices);

		this._projectionMatrix = mat4.create();
		this._viewMatrix = mat4.create();
		this._viewProjectionMatrix = mat4.create();


		this.downsampleIterations = 5;
		const blockSize = 1 << this.downsampleIterations;
		const numBlocksX = Math.trunc(canvas.width / blockSize);
		const numBlocksY = Math.trunc(canvas.height / blockSize);


		// depth prepass buffer
		this._depthTex = gl.createTexture();
		gl.bindTexture(gl.TEXTURE_2D, this._depthTex);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
		gl.texImage2D(
			gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT24,
			canvas.width, canvas.height, 0,
			gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null
		);
		gl.bindTexture(gl.TEXTURE_2D, null);

		this._depthBuffer = gl.createFramebuffer();
		gl.bindFramebuffer(gl.FRAMEBUFFER, this._depthBuffer);
		gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, this._depthTex, 0);
		if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) != gl.FRAMEBUFFER_COMPLETE) {
			throw "Framebuffer incomplete";
		}

		this._depthPrepassProgram = loadShaderProgram(
			depthPrepassVs, depthPrepassFs, {
				uniforms: ['u_viewProjectionMatrix'],
				attribs: ['a_position']
			}
		);


		// depth buffers for downsampling
		this._depthTexDs = [new Array(2), new Array(2)];
		this._depthBufferDs = [new Array(2), new Array(2)];

		for (var i = 0; i < 2; ++i) {
			for (var minmax = 0; minmax < 2; ++minmax) {
				this._depthTexDs[i][minmax] = gl.createTexture();
				gl.bindTexture(gl.TEXTURE_2D, this._depthTexDs[i][minmax]);
				gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
				gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
				gl.texImage2D(
					gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT24,
					canvas.width / 2, canvas.height / 2, 0,
					gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null
				);

				this._depthBufferDs[i][minmax] = gl.createFramebuffer();
				gl.bindFramebuffer(gl.FRAMEBUFFER, this._depthBufferDs[i][minmax]);
				gl.framebufferTexture2D(
					gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, this._depthTexDs[i][minmax], 0
				);
				if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) != gl.FRAMEBUFFER_COMPLETE) {
					throw "Framebuffer incomplete";
				}
			}
		}

		this._depthDownsampleMinProgram = loadShaderProgram(
			quadVs, depthPrepassDownsampleFs({ op: 'min' }), {
				uniforms: ['u_depth'],
				attribs: ['a_position']
			}
		);
		this._depthDownsampleMaxProgram = loadShaderProgram(
			quadVs, depthPrepassDownsampleFs({ op: 'max' }), {
				uniforms: ['u_depth'],
				attribs: ['a_position']
			}
		);


		// buffer for light information
		this._lightBuffer = gl.createBuffer();

		this._lightList = gl.createBuffer();
		gl.bindBuffer(gl.SHADER_STORAGE_BUFFER, this._lightList);
		gl.bufferData(
			gl.SHADER_STORAGE_BUFFER, EXPECTED_LIGHTS_PER_TILE * numBlocksX * numBlocksY * 8, gl.DYNAMIC_COPY
		);

		this._lightHead = gl.createBuffer();

		this._cullLightProgram = addShaderLocations(
			{ glShaderProgram: linkShader(compileShader(cullLightCs({}), gl.COMPUTE_SHADER)) },
			{ uniforms: [
				'u_width', 'u_height', 'u_blockSize', 'u_numLights',
				'u_viewMatrix', 'u_cameraRight', 'u_cameraUp', 'u_cameraNear', 'u_cameraFar',
				'u_depthMin', 'u_depthMax'
			] }
		);


		this._shaderProgram = loadShaderProgram(vsSource, fsSource({
			numLights: NUM_LIGHTS,
		}), {
			uniforms: [
				'u_viewProjectionMatrix', 'u_colmap', 'u_normap',
				'u_blockSize', 'u_numBlocksX', 'u_debugMode', 'u_debugModeParam'
			],
			attribs: ['a_position', 'a_normal', 'a_uv'],
		});


		this._depthDebugProgram = loadShaderProgram(
			quadVs, visualizeDepthFs(), {
				uniforms: ['u_depthMin', 'u_depthMax', 'u_scale', 'u_cameraNear', 'u_cameraFar', 'u_debugModeParam'],
				attribs: ['a_position']
			}
		)
	}

	downsampleBuffer(input, prog, output, width, height) {
		gl.bindFramebuffer(gl.FRAMEBUFFER, output);
		gl.viewport(0, 0, width, height);
		gl.clear(gl.DEPTH_BUFFER_BIT);
		gl.useProgram(prog.glShaderProgram);
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, input);
		gl.uniform1i(prog.u_depth, 0);
		renderFullscreenQuad(prog);
	}

	render(camera, scene) {
		// Update the camera matrices
		camera.updateMatrixWorld();
		mat4.invert(this._viewMatrix, camera.matrixWorld.elements);
		mat4.copy(this._projectionMatrix, camera.projectionMatrix.elements);
		mat4.multiply(this._viewProjectionMatrix, this._projectionMatrix, this._viewMatrix);


		const blockSize = 1 << this.downsampleIterations;
		const numBlocksX = Math.trunc(canvas.width / blockSize);
		const numBlocksY = Math.trunc(canvas.height / blockSize);


		// depth prepass
		gl.bindFramebuffer(gl.FRAMEBUFFER, this._depthBuffer);
		gl.viewport(0, 0, canvas.width, canvas.height);
		gl.clear(gl.DEPTH_BUFFER_BIT); // no need to clear color
		gl.useProgram(this._depthPrepassProgram.glShaderProgram);
		gl.uniformMatrix4fv(this._depthPrepassProgram.u_viewProjectionMatrix, false, this._viewProjectionMatrix);
		scene.draw(this._depthPrepassProgram);

		// downsample
		{
			var width = canvas.width / 2;
			var height = canvas.height / 2;
			this.downsampleBuffer(
				this._depthTex, this._depthDownsampleMinProgram, this._depthBufferDs[0][0], width, height
			);
			this.downsampleBuffer(
				this._depthTex, this._depthDownsampleMaxProgram, this._depthBufferDs[0][1], width, height
			);
			for (var i = 1; i < this.downsampleIterations; ++i) {
				width /= 2;
				height /= 2;
				this.downsampleBuffer(
					this._depthTexDs[0][0], this._depthDownsampleMinProgram, this._depthBufferDs[1][0], width, height
				);
				this.downsampleBuffer(
					this._depthTexDs[0][1], this._depthDownsampleMaxProgram, this._depthBufferDs[1][1], width, height
				);
				[this._depthTexDs[0], this._depthTexDs[1]] = [this._depthTexDs[1], this._depthTexDs[0]];
				[this._depthBufferDs[0], this._depthBufferDs[1]] = [this._depthBufferDs[1], this._depthBufferDs[0]];
			}
		}

		// compute lights
		gl.useProgram(this._cullLightProgram.glShaderProgram);
		// update light input buffer
		const lights = new Float32Array(8 * NUM_LIGHTS);
		for (let i = 0, base = 0; i < NUM_LIGHTS; ++i, base += 8) {
			lights[base + 0] = scene.lights[i].position[0];
			lights[base + 1] = scene.lights[i].position[1];
			lights[base + 2] = scene.lights[i].position[2];

			lights[base + 3] = scene.lights[i].radius;

			lights[base + 4] = scene.lights[i].color[0];
			lights[base + 5] = scene.lights[i].color[1];
			lights[base + 6] = scene.lights[i].color[2];
		}
		gl.bindBuffer(gl.SHADER_STORAGE_BUFFER, this._lightBuffer);
		gl.bufferData(gl.SHADER_STORAGE_BUFFER, lights, gl.DYNAMIC_DRAW);
		// reset light link list head buffer
		const heads = new Int32Array(numBlocksX * numBlocksY + 1);
		heads.fill(-1);
		heads[0] = 0;
		gl.bindBuffer(gl.SHADER_STORAGE_BUFFER, this._lightHead);
		gl.bufferData(gl.SHADER_STORAGE_BUFFER, heads, gl.DYNAMIC_COPY);
		// bind buffers
		gl.bindBufferBase(gl.SHADER_STORAGE_BUFFER, 0, this._lightBuffer);
		gl.bindBufferBase(gl.SHADER_STORAGE_BUFFER, 1, this._lightList);
		gl.bindBufferBase(gl.SHADER_STORAGE_BUFFER, 2, this._lightHead);
		// set uniforms
		gl.uniform1ui(this._cullLightProgram.u_width, canvas.width);
		gl.uniform1ui(this._cullLightProgram.u_height, canvas.height);
		gl.uniform1ui(this._cullLightProgram.u_blockSize, blockSize);
		gl.uniform1ui(this._cullLightProgram.u_numLights, NUM_LIGHTS);
		// camera settings
		gl.uniformMatrix4fv(this._cullLightProgram.u_viewMatrix, false, this._viewMatrix);
		const camY = Math.tan((Math.PI / 180) * 0.5 * camera.fov) / camera.zoom;
		const camX = camera.aspect * camY;
		gl.uniform1f(this._cullLightProgram.u_cameraRight, camX);
		gl.uniform1f(this._cullLightProgram.u_cameraUp, camY);
		gl.uniform1f(this._cullLightProgram.u_cameraNear, camera.near);
		gl.uniform1f(this._cullLightProgram.u_cameraFar, camera.far);
		// bind textures
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, this._depthTexDs[0][0]);
		gl.uniform1i(this._cullLightProgram.u_depthMin, 0);
		gl.activeTexture(gl.TEXTURE1);
		gl.bindTexture(gl.TEXTURE_2D, this._depthTexDs[0][1]);
		gl.uniform1i(this._cullLightProgram.u_depthMax, 1);
		// invoke compute shader
		gl.dispatchCompute(canvas.width / blockSize, canvas.height / blockSize, NUM_LIGHTS);
		gl.memoryBarrier(gl.SHADER_STORAGE_BARRIER_BIT);


		// Bind the default null framebuffer which is the screen
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
		gl.viewport(0, 0, canvas.width, canvas.height);
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

		if (globalParams.debugMode == 1) {
			// draw debug depth visualization
			gl.useProgram(this._depthDebugProgram.glShaderProgram);
			// bind textures
			gl.activeTexture(gl.TEXTURE0);
			gl.bindTexture(gl.TEXTURE_2D, this._depthTexDs[0][0]);
			gl.uniform1i(this._depthDebugProgram.u_depthMin, 0);
			gl.activeTexture(gl.TEXTURE1);
			gl.bindTexture(gl.TEXTURE_2D, this._depthTexDs[0][1]);
			gl.uniform1i(this._depthDebugProgram.u_depthMax, 1);
			// uniforms
			gl.uniform1f(this._depthDebugProgram.u_scale, 1.0 / (1 << (this.downsampleIterations - 1)));
			gl.uniform1f(this._depthDebugProgram.u_cameraNear, camera.near);
			gl.uniform1f(this._depthDebugProgram.u_cameraFar, camera.far);
			gl.uniform1f(this._depthDebugProgram.u_debugModeParam, globalParams.debugModeParam);
			renderFullscreenQuad(this._depthDebugProgram);
		} else {
			gl.useProgram(this._shaderProgram.glShaderProgram);
			// Upload the camera matrix
			gl.uniformMatrix4fv(this._shaderProgram.u_viewProjectionMatrix, false, this._viewProjectionMatrix);
			gl.uniform1ui(this._shaderProgram.u_blockSize, blockSize);
			gl.uniform1ui(this._shaderProgram.u_numBlocksX, numBlocksX);
			gl.uniform1i(this._shaderProgram.u_debugMode, globalParams.debugMode);
			gl.uniform1f(this._shaderProgram.u_debugModeParam, globalParams.debugModeParam);
			// bind buffers
			gl.bindBufferBase(gl.SHADER_STORAGE_BUFFER, 0, this._lightBuffer);
			gl.bindBufferBase(gl.SHADER_STORAGE_BUFFER, 1, this._lightList);
			gl.bindBufferBase(gl.SHADER_STORAGE_BUFFER, 2, this._lightHead);
			// Draw the scene. This function takes the shader program so that the model's textures can be bound to the right inputs
			scene.draw(this._shaderProgram);
		}
	}
};
