import frustumUtil from '../include/frustum.glsl'

export default function (params) {
	return `#version 310 es
	precision highp float;

	uniform float u_scale;
	uniform float u_cameraNear;
	uniform float u_cameraFar;
	uniform float u_debugModeParam;
	uniform uint u_blockSizeX;
	uniform uint u_blockSizeY;

	in vec2 v_uv;

	layout (std430, binding = 0) buffer ClusterDepths {
		ivec2 values[];
	} clusterDepths;

	out vec4 fragColor;

	${frustumUtil}

	void main() {
		uvec2 fragCoord = uvec2(gl_FragCoord.xy) / uvec2(u_blockSizeX, u_blockSizeY);
		uint index = fragCoord.y * ${params.xSlices}u + fragCoord.x;

		float depthMin = intBitsToFloat(clusterDepths.values[index].x);
		depthMin = (depthMin - u_cameraNear) / (u_cameraFar - u_cameraNear);
		float depthMax = intBitsToFloat(clusterDepths.values[index].y);
		depthMax = (depthMax - u_cameraNear) / (u_cameraFar - u_cameraNear);

		float debugMul = mix(1.0f, 100.0f, u_debugModeParam);

		fragColor = vec4(depthMax * debugMul, depthMin * debugMul, 0.0f, 1.0f);
	}
	`;
}
