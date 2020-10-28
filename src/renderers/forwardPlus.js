import { gl, canvas, abort, globalParams } from '../init';
import { mat4, vec4, vec3 } from 'gl-matrix';
import { compileShader, linkShader, addShaderLocations, loadShaderProgram, renderFullscreenQuad } from '../utils';
import { NUM_LIGHTS } from '../scene';
import TextureBuffer from './textureBuffer';
import BaseRenderer from './base';

import depthPrepassVs from "../shaders/forwardPlus/depthPrepass.vert.glsl";
import depthPrepassFs from '../shaders/forwardPlus/depthPrepass.frag.glsl';
import clearClusterDepthCs from '../shaders/forwardPlus/clearClusterDepth.glsl.js'
import depthPrepassDownsampleCs from '../shaders/forwardPlus/depthDownsampleForwardPlus.glsl.js'
import cullLightCs from '../shaders/forwardPlus/cullLightsForwardPlus.glsl.js'
import vsSource from '../shaders/forwardPlus/forwardPlus.vert.glsl';
import fsSource from '../shaders/forwardPlus/forwardPlus.frag.glsl.js';
import visualizeDepthFs from '../shaders/forwardPlus/visualizeDepth.frag.glsl.js';

import quadVs from '../shaders/quad.vert.glsl';

const EXPECTED_LIGHTS_PER_TILE = Math.ceil(NUM_LIGHTS / 2);

export default class ForwardPlusRenderer extends BaseRenderer {
	constructor(xSlices, ySlices, zSlices) {
		super(xSlices, ySlices, zSlices);

		this._projectionMatrix = mat4.create();
		this._viewMatrix = mat4.create();
		this._viewProjectionMatrix = mat4.create();
		this._width = canvas.width;
		this._height = canvas.height;

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


		// depth buffer downsampling
		this._depthClusters = gl.createBuffer();
		gl.bindBuffer(gl.SHADER_STORAGE_BUFFER, this._depthClusters);
		gl.bufferData(gl.SHADER_STORAGE_BUFFER, this._xSlices * this._ySlices * 2 * 4, gl.DYNAMIC_COPY);

		this._clearClusterDepthProgram = {
			glShaderProgram: linkShader(compileShader(
				clearClusterDepthCs({ xSlices: this._xSlices, ySlices: this._ySlices }), gl.COMPUTE_SHADER
			))
		};

		this._depthDownsampleProgram = addShaderLocations(
			{
				glShaderProgram: linkShader(compileShader(depthPrepassDownsampleCs(
					{ xSlices: this._xSlices, ySlices: this._ySlices }), gl.COMPUTE_SHADER
				))
			}, {
				uniforms: ['u_blockSizeX', 'u_blockSizeY', 'u_cameraNear', 'u_cameraFar', 'u_depth']
			}
		);


		// buffer for light information
		const lightListSize = EXPECTED_LIGHTS_PER_TILE * this._xSlices * this._ySlices;

		this._lightBuffer = gl.createBuffer();

		this._lightList = gl.createBuffer();
		gl.bindBuffer(gl.SHADER_STORAGE_BUFFER, this._lightList);
		gl.bufferData(gl.SHADER_STORAGE_BUFFER, lightListSize * 8, gl.DYNAMIC_COPY);

		this._lightHead = gl.createBuffer();

		this._lightNodeCount = gl.createBuffer();

		this._cullLightProgram = addShaderLocations(
			{
				glShaderProgram: linkShader(compileShader(
					cullLightCs({
						xSlices: this._xSlices,
						ySlices: this._ySlices,
						lightListSize: lightListSize
					}), gl.COMPUTE_SHADER
				))
			}, {
				uniforms: [
					'u_width', 'u_height', 'u_blockSizeX', 'u_blockSizeY', 'u_numLights',
					'u_viewMatrix', 'u_cameraRight', 'u_cameraUp'
				]
			}
		);


		// final shading
		this._shaderProgram = loadShaderProgram(vsSource, fsSource({
			xSlices: this._xSlices, numLights: NUM_LIGHTS,
		}), {
			uniforms: [
				'u_viewProjectionMatrix', 'u_colmap', 'u_normap',
				'u_blockSizeX', 'u_blockSizeY', 'u_debugMode', 'u_debugModeParam'
			],
			attribs: ['a_position', 'a_normal', 'a_uv'],
		});


		this._depthDebugProgram = loadShaderProgram(
			quadVs, visualizeDepthFs({ xSlices: this._xSlices, ySlices: this._ySlices }),
			{
				uniforms: [
					'u_scale', 'u_cameraNear', 'u_cameraFar', 'u_debugModeParam', 'u_blockSizeX', 'u_blockSizeY'
				],
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

	resize(width, height) {
		this._width = width;
		this._height = height;

		gl.bindTexture(gl.TEXTURE_2D, this._depthTex);
		gl.texImage2D(
			gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT24, width, height, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null
		);
	}

	render(camera, scene) {
		if (canvas.width != this._width || canvas.height != this._height) {
			this.resize(canvas.width, canvas.height);
		}

		// Update the camera matrices
		camera.updateMatrixWorld();
		mat4.invert(this._viewMatrix, camera.matrixWorld.elements);
		mat4.copy(this._projectionMatrix, camera.projectionMatrix.elements);
		mat4.multiply(this._viewProjectionMatrix, this._projectionMatrix, this._viewMatrix);

		const blockSizeX = Math.trunc(canvas.width / this._xSlices);
		const blockSizeY = Math.trunc(canvas.height / this._ySlices);
		const numBlocks = this._xSlices * this._ySlices;


		// depth prepass
		gl.bindFramebuffer(gl.FRAMEBUFFER, this._depthBuffer);
		gl.viewport(0, 0, canvas.width, canvas.height);
		gl.clear(gl.DEPTH_BUFFER_BIT); // no need to clear color
		gl.useProgram(this._depthPrepassProgram.glShaderProgram);
		gl.uniformMatrix4fv(this._depthPrepassProgram.u_viewProjectionMatrix, false, this._viewProjectionMatrix);
		scene.draw(this._depthPrepassProgram);


		// clear depth clusters
		gl.useProgram(this._clearClusterDepthProgram.glShaderProgram);
		gl.bindBufferBase(gl.SHADER_STORAGE_BUFFER, 0, this._depthClusters);
		gl.dispatchCompute((numBlocks + 63) / 64, 1, 1);
		// downsample
		gl.useProgram(this._depthDownsampleProgram.glShaderProgram);
		gl.bindBufferBase(gl.SHADER_STORAGE_BUFFER, 0, this._depthClusters);
		// uniforms
		gl.uniform1ui(this._depthDownsampleProgram.u_blockSizeX, blockSizeX);
		gl.uniform1ui(this._depthDownsampleProgram.u_blockSizeY, blockSizeY);
		gl.uniform1f(this._depthDownsampleProgram.u_cameraNear, camera.near);
		gl.uniform1f(this._depthDownsampleProgram.u_cameraFar, camera.far);
		// texture
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, this._depthTex);
		gl.uniform1i(this._depthDownsampleProgram.u_depth, 0);
		// invoke compute shader
		gl.dispatchCompute((canvas.width + 7) / 8, (canvas.height + 7) / 8, 1);


		// cull lights
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
		const heads = new Int32Array(this._xSlices * this._ySlices);
		heads.fill(-1);
		gl.bindBuffer(gl.SHADER_STORAGE_BUFFER, this._lightHead);
		gl.bufferData(gl.SHADER_STORAGE_BUFFER, heads, gl.DYNAMIC_COPY);
		// reset node count
		const count = new Uint32Array([0]);
		gl.bindBuffer(gl.ATOMIC_COUNTER_BUFFER, this._lightNodeCount);
		gl.bufferData(gl.ATOMIC_COUNTER_BUFFER, count, gl.DYNAMIC_DRAW);
		// bind buffers
		gl.bindBufferBase(gl.SHADER_STORAGE_BUFFER, 0, this._depthClusters);
		gl.bindBufferBase(gl.SHADER_STORAGE_BUFFER, 1, this._lightBuffer);
		gl.bindBufferBase(gl.SHADER_STORAGE_BUFFER, 2, this._lightList);
		gl.bindBufferBase(gl.SHADER_STORAGE_BUFFER, 3, this._lightHead);
		gl.bindBufferBase(gl.ATOMIC_COUNTER_BUFFER, 4, this._lightNodeCount);
		// set uniforms
		gl.uniform1ui(this._cullLightProgram.u_width, canvas.width);
		gl.uniform1ui(this._cullLightProgram.u_height, canvas.height);
		gl.uniform1ui(this._cullLightProgram.u_blockSizeX, blockSizeX);
		gl.uniform1ui(this._cullLightProgram.u_blockSizeY, blockSizeY);
		gl.uniform1ui(this._cullLightProgram.u_numLights, NUM_LIGHTS);
		// camera settings
		gl.uniformMatrix4fv(this._cullLightProgram.u_viewMatrix, false, this._viewMatrix);
		const camY = Math.tan((Math.PI / 180) * 0.5 * camera.fov) / camera.zoom;
		const camX = camera.aspect * camY;
		gl.uniform1f(this._cullLightProgram.u_cameraRight, camX);
		gl.uniform1f(this._cullLightProgram.u_cameraUp, camY);
		gl.uniform1f(this._cullLightProgram.u_cameraNear, camera.near);
		gl.uniform1f(this._cullLightProgram.u_cameraFar, camera.far);
		// invoke compute shader
		gl.dispatchCompute((this._xSlices + 7) / 8, (this._ySlices + 7) / 8, NUM_LIGHTS);
		gl.memoryBarrier(gl.SHADER_STORAGE_BARRIER_BIT);


		// Bind the default null framebuffer which is the screen
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
		gl.viewport(0, 0, canvas.width, canvas.height);
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

		if (globalParams.debugMode == 1) {
			// draw debug depth visualization
			gl.useProgram(this._depthDebugProgram.glShaderProgram);
			// bind textures
			gl.bindBufferBase(gl.SHADER_STORAGE_BUFFER, 0, this._depthClusters);
			// uniforms
			gl.uniform1f(this._depthDebugProgram.u_scale, 1.0 / (1 << (this.downsampleIterations - 1)));
			gl.uniform1f(this._depthDebugProgram.u_cameraNear, camera.near);
			gl.uniform1f(this._depthDebugProgram.u_cameraFar, camera.far);
			gl.uniform1f(this._depthDebugProgram.u_debugModeParam, globalParams.debugModeParam);
			gl.uniform1ui(this._depthDebugProgram.u_blockSizeX, blockSizeX);
			gl.uniform1ui(this._depthDebugProgram.u_blockSizeY, blockSizeY);
			renderFullscreenQuad(this._depthDebugProgram);
		} else {
			gl.useProgram(this._shaderProgram.glShaderProgram);
			// Upload the camera matrix
			gl.uniformMatrix4fv(this._shaderProgram.u_viewProjectionMatrix, false, this._viewProjectionMatrix);
			gl.uniform1ui(this._shaderProgram.u_blockSizeX, blockSizeX);
			gl.uniform1ui(this._shaderProgram.u_blockSizeY, blockSizeY);
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
