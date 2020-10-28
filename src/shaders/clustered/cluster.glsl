struct ClusterInfo {
	int xMin, xMax, yMin, yMax;
	int depthMin, depthMax;
};

uint getClusterIndex(uvec3 xyz, uint xSlices, uint zSlices) {
	return (xyz.y * xSlices + xyz.x) * zSlices + xyz.z;
}

uint depth01ToDepthCluster(float depth01, uint zSlices) {
	return uint(depth01 * float(zSlices));
}
float clusterNearDepth01(uint cluster, uint zSlices) {
	return float(cluster) / float(zSlices);
}
