import frustumUtil from './include/frustum.glsl'

export default function () {
	return `#version 310 es
	precision highp float;

	uniform sampler2D u_depthMin, u_depthMax;
	uniform float u_scale;
	uniform float u_cameraNear;
	uniform float u_cameraFar;
	uniform float u_debugModeParam;

	in vec2 v_uv;

	out vec4 fragColor;

	${frustumUtil}

	void main() {
		float depthMin = depthSampleToWorld(
			texture(u_depthMin, v_uv * u_scale).x, u_cameraNear, u_cameraFar
		) / u_cameraFar;
		float depthMax = depthSampleToWorld(
			texture(u_depthMax, v_uv * u_scale).x, u_cameraNear, u_cameraFar
		) / u_cameraFar;

		float debugMul = mix(1.0f, 100.0f, u_debugModeParam);

		fragColor = vec4(depthMax * debugMul, depthMin * debugMul, 0.0f, 1.0f);
	}
	`;
}
