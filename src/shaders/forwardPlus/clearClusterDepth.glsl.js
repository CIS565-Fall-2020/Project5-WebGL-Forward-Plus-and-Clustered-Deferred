export default function(params) {
	return `#version 310 es
	precision highp float;

	layout (local_size_x = 64, local_size_y = 1, local_size_z = 1) in;

	layout(std430, binding = 0) buffer ClusterDepths {
		ivec2 values[];
	} clusterDepths;

	void main() {
		uint id = gl_GlobalInvocationID.x;
		if (id >= ${params.xSlices}u * ${params.ySlices}u) {
			return;
		}
		clusterDepths.values[id] = ivec2(floatBitsToInt(1e6), floatBitsToInt(1e-6));
	}
	`;
}
