import frustumUtils from '../include/frustum.glsl'
import lightingUtils from '../include/lighting.glsl'
import cluster from './cluster.glsl'

export default function(params) {
	return `#version 310 es
	precision highp float;

	layout (local_size_x = 8, local_size_y = 8, local_size_z = 8) in;

	uniform uint u_numLights;
	uniform float u_camRight;
	uniform float u_camUp;
	uniform uint u_width;
	uniform uint u_height;
	uniform mat4 u_view;

	${frustumUtils}
	${lightingUtils}
	${cluster}

	layout (std430, binding = 0) buffer ClusterDepths {
		ClusterInfo data[];
	} clusterDepths;
	layout (std430, binding = 1) buffer LightIn {
		Light lights[];
	} lights;
	layout (std430, binding = 2) buffer LightHead {
		int head[];
	} head;
	layout (std430, binding = 3) buffer LightList {
		ivec2 node[];
	} list;
	layout (binding = 4) uniform atomic_uint u_numNodes;

	void main() {
		uvec2 clusterXY = gl_GlobalInvocationID.xy;
		uint lightIndex = gl_GlobalInvocationID.z;
		if (
			clusterXY.x >= ${params.xSlices}u ||
			clusterXY.y >= ${params.ySlices}u ||
			lightIndex >= u_numLights
		) {
			return;
		}

		vec3 lightCenter = (u_view * vec4(lights.lights[lightIndex].position, 1.0f)).xyz;
		lightCenter.z = -lightCenter.z;
		float lightRadius = lights.lights[lightIndex].radius;

		uvec3 clusterId = uvec3(clusterXY, 0);
		while (clusterId.z < ${params.zSlices}u) {
			// find next non-empty cluster
			uint clusterIndex = getClusterIndex(clusterId, ${params.xSlices}u, ${params.zSlices}u);
			while (
				clusterId.z < ${params.zSlices}u &&
				clusterDepths.data[clusterIndex].xMin > clusterDepths.data[clusterIndex].xMax
			) {
				++clusterId.z;
				// technically we can simply ++clusterIndex, but it's dependent on the layout
				// hopefully the compiler optimizes this
				clusterIndex = getClusterIndex(clusterId, ${params.xSlices}u, ${params.zSlices}u);
			}

			if (clusterId.z < ${params.zSlices}u) { // found cluster
				// test intersection
				ClusterInfo cluster = clusterDepths.data[clusterIndex];
				Frustum fr = computeFrustum(
					u_camRight, u_camUp, uvec2(u_width, u_height),
					uvec2(cluster.xMin, cluster.yMin), uvec2(cluster.xMax, cluster.yMax),
					intBitsToFloat(cluster.depthMin), intBitsToFloat(cluster.depthMax)
				);

				if (frustumSphereIntersectionPossible(fr, lightCenter, lightRadius)) {
					int node = int(atomicCounterIncrement(u_numNodes));
					int next = atomicExchange(head.head[clusterIndex], node);
					list.node[node] = ivec2(lightIndex, next);
				}

				++clusterId.z;
			}
		}
	}
	`;
}
