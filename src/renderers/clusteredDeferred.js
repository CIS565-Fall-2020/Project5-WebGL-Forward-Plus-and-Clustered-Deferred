import { gl, canvas, globalParams } from '../init';
import { mat4, vec4 } from 'gl-matrix';
import { addShaderLocations, compileShader, linkShader, loadShaderProgram, renderFullscreenQuad } from '../utils';
import { NUM_LIGHTS } from '../scene';
import TextureBuffer from './textureBuffer';
import BaseRenderer from './base';

import toTextureVert from '../shaders/clustered/deferredToTexture.vert.glsl';
import toTextureFrag from '../shaders/clustered/deferredToTexture.frag.glsl';
import clearClusterDepthCs from '../shaders/clustered/clearClusterDepth.glsl';
import collectDepthCs from '../shaders/clustered/collectDepth.glsl.js';
import cullLightCs from '../shaders/clustered/cullLightsClustered.glsl.js'
import fsSource from '../shaders/clustered/deferred.frag.glsl.js';

import depthDebugFs from '../shaders/clustered/debugVisualizeClusterDepth.frag.glsl.js'

import QuadVertSource from '../shaders/quad.vert.glsl';
import debugVisualizeClusterDepthFragGlsl from '../shaders/clustered/debugVisualizeClusterDepth.frag.glsl.js';

export const NUM_GBUFFERS = 2;

const EXPECTED_LIGHTS_PER_CLUSTER = Math.ceil(NUM_LIGHTS / 2);

export default class ClusteredDeferredRenderer extends BaseRenderer {
	constructor(xSlices, ySlices, zSlices) {
		super(xSlices, ySlices, zSlices);

		this._projectionMatrix = mat4.create();
		this._viewMatrix = mat4.create();
		this._viewProjectionMatrix = mat4.create();

		const blockSizeX = Math.trunc(canvas.width / this._xSlices);
		const blockSizeY = Math.trunc(canvas.height / this._ySlices);


		// g buffer pass
		this.setupDrawBuffers(canvas.width, canvas.height);

		this._gBufferPass = loadShaderProgram(toTextureVert, toTextureFrag, {
			uniforms: ['u_viewProjectionMatrix', 'u_colmap', 'u_normap'],
			attribs: ['a_position', 'a_normal', 'a_uv'],
		});


		// cluster depth collection pass
		this._clusterDepthBuffer = gl.createBuffer();
		gl.bindBuffer(gl.SHADER_STORAGE_BUFFER, this._clusterDepthBuffer);
		gl.bufferData(
			gl.SHADER_STORAGE_BUFFER,
			this._xSlices * this._ySlices * this._zSlices * 6 * 4,
			gl.DYNAMIC_COPY
		);

		this._clearClusterDepthCs = {
			glShaderProgram: linkShader(compileShader(clearClusterDepthCs({
				xSlices: this._xSlices, ySlices: this._ySlices, zSlices: this._zSlices
			}), gl.COMPUTE_SHADER))
		};

		this._collectDepthCs = addShaderLocations(
			{
				glShaderProgram: linkShader(compileShader(collectDepthCs({
					xSlices: this._xSlices,
					ySlices: this._ySlices,
					zSlices: this._zSlices
				}), gl.COMPUTE_SHADER))
			},
			{ uniforms: ['u_cameraNear', 'u_cameraFar', 'u_blockSizeX', 'u_blockSizeY', 'u_depth'] }
		);


		// cull light pass
		const lightListSize = EXPECTED_LIGHTS_PER_CLUSTER * this._xSlices * this._ySlices * this._zSlices;

		this._lightBuffer = gl.createBuffer();

		this._lightList = gl.createBuffer();
		gl.bindBuffer(gl.SHADER_STORAGE_BUFFER, this._lightList);
		gl.bufferData(gl.SHADER_STORAGE_BUFFER, lightListSize * 8, gl.DYNAMIC_COPY);

		this._lightHead = gl.createBuffer();

		this._lightNodeCount = gl.createBuffer();

		this._cullLightShader = addShaderLocations(
			{
				glShaderProgram: linkShader(compileShader(cullLightCs({
					xSlices: this._xSlices,
					ySlices: this._ySlices,
					zSlices: this._zSlices,
					lightListSize: lightListSize
				}), gl.COMPUTE_SHADER))
			},
			{ uniforms: ['u_numLights', 'u_camRight', 'u_camUp', 'u_width', 'u_height', 'u_view'] }
		);


		// final shading pass
		this._progShade = loadShaderProgram(QuadVertSource, fsSource({
			numLights: NUM_LIGHTS,
			numGBuffers: NUM_GBUFFERS,
			xSlices: this._xSlices,
			zSlices: this._zSlices
		}), {
			uniforms: [
				'u_gbuffers[0]', 'u_gbuffers[1]', 'u_depth',
				'u_cameraNear', 'u_cameraFar', 'u_cameraRight', 'u_cameraUp', 'u_invView',
				'u_blockSizeX', 'u_blockSizeY', 'u_debugMode', 'u_debugModeParam'
			],
			attribs: ['a_position'],
		});


		// debug
		this._debugDepthShader = loadShaderProgram(
			QuadVertSource, depthDebugFs({
				blockSizeX: blockSizeX,
				blockSizeY: blockSizeY,
				xSlices: this._xSlices,
				ySlices: this._ySlices,
				zSlices: this._zSlices
			}), {
				uniforms: ['u_depthLayer', 'u_cameraNear', 'u_cameraFar', 'u_depth']
			}
		);
	}

	setupDrawBuffers(width, height) {
		this._width = width;
		this._height = height;


		//Create, bind, and store a depth target texture for the FBO
		this._depthTex = gl.createTexture();
		gl.bindTexture(gl.TEXTURE_2D, this._depthTex);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);


		this._gBuffer = gl.createFramebuffer();
		gl.bindFramebuffer(gl.FRAMEBUFFER, this._gBuffer);
		gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, this._depthTex, 0);

		// Create, bind, and store "color" target textures for the FBO
		this._gbuffers = new Array(NUM_GBUFFERS);
		for (let i = 0; i < NUM_GBUFFERS; i++) {
			this._gbuffers[i] = gl.createTexture();
			gl.bindTexture(gl.TEXTURE_2D, this._gbuffers[i]);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
		}

		this.resize(this._width, this._height);

		let attachments = new Array(NUM_GBUFFERS);
		for (let i = 0; i < NUM_GBUFFERS; ++i) {
			attachments[i] = gl[`COLOR_ATTACHMENT${i}`];
			gl.bindTexture(gl.TEXTURE_2D, this._gbuffers[i]);
			gl.framebufferTexture2D(gl.FRAMEBUFFER, attachments[i], gl.TEXTURE_2D, this._gbuffers[i], 0);
		}
		if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) != gl.FRAMEBUFFER_COMPLETE) {
			throw "Framebuffer incomplete";
		}
		gl.drawBuffers(attachments);
	}

	resize(width, height) {
		this._width = width;
		this._height = height;

		gl.bindTexture(gl.TEXTURE_2D, this._depthTex);
		gl.texImage2D(
			gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT24, width, height, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null
		);

		// float16 for normal
		gl.bindTexture(gl.TEXTURE_2D, this._gbuffers[0]);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, width, height, 0, gl.RGBA, gl.HALF_FLOAT, null);

		// uint8 for albedo
		gl.bindTexture(gl.TEXTURE_2D, this._gbuffers[1]);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
	}

	render(camera, scene) {
		if (canvas.width != this._width || canvas.height != this._height) {
			this.resize(canvas.width, canvas.height);
		}

		const blockSizeX = Math.trunc(canvas.width / this._xSlices);
		const blockSizeY = Math.trunc(canvas.height / this._ySlices);
		const numClusters = this._xSlices * this._ySlices * this._zSlices;


		// Update the camera matrices
		camera.updateMatrixWorld();
		mat4.invert(this._viewMatrix, camera.matrixWorld.elements);
		mat4.copy(this._projectionMatrix, camera.projectionMatrix.elements);
		mat4.multiply(this._viewProjectionMatrix, this._projectionMatrix, this._viewMatrix);


		// render g buffer
		gl.bindFramebuffer(gl.FRAMEBUFFER, this._gBuffer);
		gl.viewport(0, 0, canvas.width, canvas.height);
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

		gl.useProgram(this._gBufferPass.glShaderProgram);
		gl.uniformMatrix4fv(this._gBufferPass.u_viewProjectionMatrix, false, this._viewProjectionMatrix);
		scene.draw(this._gBufferPass);


		// clear clusters
		gl.useProgram(this._clearClusterDepthCs.glShaderProgram);
		gl.bindBufferBase(gl.SHADER_STORAGE_BUFFER, 0, this._clusterDepthBuffer);
		gl.dispatchCompute((numClusters + 63) / 64, 1, 1);
		gl.memoryBarrier(gl.SHADER_STORAGE_BARRIER_BIT);

		// collect clusters
		gl.useProgram(this._collectDepthCs.glShaderProgram);
		gl.bindBufferBase(gl.SHADER_STORAGE_BUFFER, 0, this._clusterDepthBuffer);
		gl.uniform1f(this._collectDepthCs.u_cameraNear, camera.near);
		gl.uniform1f(this._collectDepthCs.u_cameraFar, camera.far);
		gl.uniform1ui(this._collectDepthCs.u_blockSizeX, blockSizeX);
		gl.uniform1ui(this._collectDepthCs.u_blockSizeY, blockSizeY);
		// bind texture
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, this._depthTex);
		gl.uniform1i(this._collectDepthCs.u_depth, 0);
		// run compute shader
		gl.dispatchCompute((canvas.width + 7) / 8, (canvas.height + 7) / 8, 1);
		gl.memoryBarrier(gl.SHADER_STORAGE_BARRIER_BIT);


		// cull lights
		gl.useProgram(this._cullLightShader.glShaderProgram);
		// gather lights
		const lightArray = new Float32Array(NUM_LIGHTS * 8);
		for (let i = 0, base = 0; i < NUM_LIGHTS; ++i, base += 8) {
			lightArray[base + 0] = scene.lights[i].position[0];
			lightArray[base + 1] = scene.lights[i].position[1];
			lightArray[base + 2] = scene.lights[i].position[2];
			lightArray[base + 3] = scene.lights[i].radius;

			lightArray[base + 4] = scene.lights[i].color[0];
			lightArray[base + 5] = scene.lights[i].color[1];
			lightArray[base + 6] = scene.lights[i].color[2];
		}
		gl.bindBuffer(gl.SHADER_STORAGE_BUFFER, this._lightBuffer);
		gl.bufferData(gl.SHADER_STORAGE_BUFFER, lightArray, gl.DYNAMIC_DRAW);
		// reset head
		const heads = new Int32Array(numClusters);
		heads.fill(-1);
		gl.bindBuffer(gl.SHADER_STORAGE_BUFFER, this._lightHead);
		gl.bufferData(gl.SHADER_STORAGE_BUFFER, heads, gl.DYNAMIC_COPY);
		// reset counter
		const counter = new Uint32Array([0]);
		gl.bindBuffer(gl.ATOMIC_COUNTER_BUFFER, this._lightNodeCount);
		gl.bufferData(gl.ATOMIC_COUNTER_BUFFER, counter, gl.DYNAMIC_DRAW);
		// bind buffers
		gl.bindBufferBase(gl.SHADER_STORAGE_BUFFER, 0, this._clusterDepthBuffer);
		gl.bindBufferBase(gl.SHADER_STORAGE_BUFFER, 1, this._lightBuffer);
		gl.bindBufferBase(gl.SHADER_STORAGE_BUFFER, 2, this._lightHead);
		gl.bindBufferBase(gl.SHADER_STORAGE_BUFFER, 3, this._lightList);
		gl.bindBufferBase(gl.ATOMIC_COUNTER_BUFFER, 4, this._lightNodeCount);
		// uniforms
		gl.uniform1ui(this._cullLightShader.u_numLights, NUM_LIGHTS);
		const camY = Math.tan((Math.PI / 180) * 0.5 * camera.fov) / camera.zoom;
		const camX = camera.aspect * camY;
		gl.uniform1f(this._cullLightShader.u_camRight, camX);
		gl.uniform1f(this._cullLightShader.u_camUp, camY);
		gl.uniform1ui(this._cullLightShader.u_width, canvas.width);
		gl.uniform1ui(this._cullLightShader.u_height, canvas.height);
		gl.uniformMatrix4fv(this._cullLightShader.u_view, false, this._viewMatrix);
		// run compute shader
		gl.dispatchCompute((this._xSlices + 7) / 8, (this._ySlices + 7) / 8, (NUM_LIGHTS + 3) / 4);
		gl.memoryBarrier(gl.SHADER_STORAGE_BARRIER_BIT);


		// Bind the default null framebuffer which is the screen
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

		if (globalParams.debugMode == 1) {
			gl.useProgram(this._debugDepthShader.glShaderProgram);
			gl.bindBufferBase(gl.SHADER_STORAGE_BUFFER, 0, this._clusterDepthBuffer);
			// uniforms
			gl.uniform1f(this._debugDepthShader.u_depthLayer, globalParams.debugModeParam);
			gl.uniform1f(this._debugDepthShader.u_cameraNear, camera.near);
			gl.uniform1f(this._debugDepthShader.u_cameraFar, camera.far);
			// depth
			gl.activeTexture(gl.TEXTURE0);
			gl.bindTexture(gl.TEXTURE_2D, this._depthTex);
			gl.uniform1i(this._debugDepthShader.u_depth, 0);
			renderFullscreenQuad(this._debugDepthShader);
		} else {
			gl.useProgram(this._progShade.glShaderProgram);
			// bind g-buffers
			gl.activeTexture(gl.TEXTURE0);
			gl.bindTexture(gl.TEXTURE_2D, this._depthTex);
			gl.uniform1i(this._progShade.u_depth, 0);
			const firstGBufferBinding = 1;
			for (let i = 0; i < NUM_GBUFFERS; i++) {
				gl.activeTexture(gl[`TEXTURE${i + firstGBufferBinding}`]);
				gl.bindTexture(gl.TEXTURE_2D, this._gbuffers[i]);
				gl.uniform1i(this._progShade[`u_gbuffers[${i}]`], i + firstGBufferBinding);
			}
			// bind buffers
			gl.bindBufferBase(gl.SHADER_STORAGE_BUFFER, 0, this._lightBuffer);
			gl.bindBufferBase(gl.SHADER_STORAGE_BUFFER, 1, this._lightHead);
			gl.bindBufferBase(gl.SHADER_STORAGE_BUFFER, 2, this._lightList);
			// uniforms
			gl.uniform1f(this._progShade.u_cameraNear, camera.near);
			gl.uniform1f(this._progShade.u_cameraFar, camera.far);
			gl.uniform1f(this._progShade.u_cameraRight, camX);
			gl.uniform1f(this._progShade.u_cameraUp, camY);
			gl.uniformMatrix4fv(this._progShade.u_invView, false, camera.matrixWorld.elements);
			gl.uniform1ui(this._progShade.u_blockSizeX, blockSizeX);
			gl.uniform1ui(this._progShade.u_blockSizeY, blockSizeY);
			gl.uniform1i(this._progShade.u_debugMode, globalParams.debugMode);
			gl.uniform1f(this._progShade.u_debugModeParam, globalParams.debugModeParam);
			// render
			renderFullscreenQuad(this._progShade);
		}
	}
};
