/** @override */
export const measureDistances = function (segments, options = {}) {
	if (!options.gridSpaces) return BaseGrid.prototype.measureDistances.call(this, segments, options);

	// Track the total number of diagonals
	let nDiagonal = 0;
	// const rule = this.parent.diagonalRule;
	const d = canvas.dimensions;

	// Iterate over measured segments
	return segments.map((s) => {
		let r = s.ray;

		// Determine the total distance traveled
		let nx = Math.abs(Math.ceil(r.dx / d.size));
		let ny = Math.abs(Math.ceil(r.dy / d.size));

		// Determine the number of straight and diagonal moves
		let nd = Math.min(nx, ny);
		let ns = Math.abs(ny - nx);
		nDiagonal += nd;
		return (ns + nd * 2) * canvas.scene.grid.distance;
	});
};
