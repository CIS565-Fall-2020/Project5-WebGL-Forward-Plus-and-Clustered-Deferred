import cluster from './cluster.glsl'

export default function(params) {
	return `#version 310 es
	precision highp float;

	layout (local_size_x = 64, local_size_y = 1, local_size_z = 1) in;

	${cluster}

	layout(std430, binding = 0) buffer ClusterDepths {
		ClusterInfo values[];
	} clusterDepths;

	void main() {
		uint id = gl_GlobalInvocationID.x;
		if (id >= ${params.xSlices}u * ${params.ySlices}u * ${params.zSlices}u) {
			return;
		}
		clusterDepths.values[id].xMin = 10000;
		clusterDepths.values[id].xMax = -1;
		clusterDepths.values[id].yMin = 10000;
		clusterDepths.values[id].yMax = -1;
		clusterDepths.values[id].depthMin = floatBitsToInt(1e6f);
		clusterDepths.values[id].depthMax = floatBitsToInt(1e-6f);
	}
	`;
}
