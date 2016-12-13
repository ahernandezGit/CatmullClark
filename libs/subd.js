/**
 * @author mrdoob / http://mrdoob.com/
 */

THREE.Geometry2 = function ( size ) {

	THREE.BufferGeometry.call( this );

	this.addAttribute( 'position', new Float32Array( size * 3 ), 3 );
	this.addAttribute( 'normal', new Float32Array( size * 3 ), 3 );
	this.addAttribute( 'uv', new Float32Array( size * 2 ), 2 );

	this.vertices = this.getAttribute( 'position' ).array;
	this.normals = this.getAttribute( 'normal' ).array;
	this.uvs = this.getAttribute( 'uv' ).array;

	this.boundingBox = null;
	this.boundingSphere = null;

};

THREE.Geometry2.prototype = Object.create( THREE.BufferGeometry.prototype );
/**
* @author wadeb / http://wadeb.com/
*/

function HalfEdge(faceIndex, vert0, vert1) {
	this.faceIndex = faceIndex;
	this.vert0 = vert0;
	this.vert1 = vert1;
	this.master = false;
	this.index = null;
	this.opposite = null;
	this.faceNext = null;
	this.facePrev = null;
	this.vertNext = null;
	this.vertPrev = null;
	this.sub0 = null;
	this.sub1 = null;
	this.inner = null;
	this.outer = null;
}

// The Quad Edge mesh is a useful data structure for navigating manifold topology.
// For documentation, see http://www.cs.cmu.edu/afs/andrew/scs/cs/15-463/2001/pub/src/a2/quadedge.html
THREE.QuadEdgeMesh = function(mesh) {

	this.edges = [];
	this.edgeTable = {};
	this.vertEdges = [];
	this.faceEdges = [];
	this.vertCount = 0;
	this.edgeCount = 0;

	if (mesh) {
		this.vertCount = mesh.verts.length;
	
		for (var i = 0; i < mesh.faces.length; i++)
			this.addFace(mesh.faces[i]);
	
		this.finishEdges();
	}
}

function makeEdgeHash(vertCount, vert0, vert1) {
	return vertCount * vert0 + vert1;
};

THREE.QuadEdgeMesh.prototype.addFace = function(verts) {
	var edges = this.edges;
	var edgeTable = this.edgeTable;

	var faceIndex = this.faceEdges.length;
	var firstEdgeIndex = edges.length;

	var index0 = 0;
	var index1 = 1;
	var faceVertCount = verts.length;
	var vertCount = this.vertCount;

	// Add all the face's half edges into the edge structure.
	while (index0 < faceVertCount) {
		var vert0 = verts[index0];
		var vert1 = verts[index1];

		// Build half edge structure.
		edge = new HalfEdge(faceIndex, vert0, vert1);
		edges.push(edge);

		// Insert into hash table for looking up its opposite.
		// If two or more edges use the same vertices in the same winding order, the mesh is non-manifold
		// and is not a valid Catmull Clark Subdivision Surface.
		var edgeHash = makeEdgeHash(vertCount, vert0, vert1);
		if (edgeTable[edgeHash]) {
			throw "Non-manifold edge in input data between verts "+vert0+" and "+vert1;
		}
		edgeTable[edgeHash] = edge;

		// Connect edges to their opposite half edge.
		// E.g. the same vertices but in the opposite direction.
		var reverseEdgeHash = makeEdgeHash(vertCount, vert1, vert0);
		var reverseEdge = edgeTable[reverseEdgeHash];
		if (reverseEdge) {
			edge.opposite = reverseEdge;
			reverseEdge.opposite = edge;
		}

		index0++;
		index1++;
		if (index1 == faceVertCount)
			index1 = 0;
	}
	
	// Connect edges to their neighbors on the same face.
	var firstEdge = edges[firstEdgeIndex];		
	firstEdge.faceNext = edges[firstEdgeIndex + 1];
	firstEdge.facePrev = edges[firstEdgeIndex + faceVertCount - 1];

	for (var i = 1; i < faceVertCount - 1; i++) {
		var edge = edges[firstEdgeIndex + i];
		edge.faceNext = edges[firstEdgeIndex + i + 1];
		edge.facePrev = edges[firstEdgeIndex + i - 1];
	}

	var lastEdge = edges[firstEdgeIndex + faceVertCount - 1];
	lastEdge.faceNext = edges[firstEdgeIndex];
	lastEdge.facePrev = edges[firstEdgeIndex + faceVertCount - 2];

	// Store the first edge on the face to mark its beginning.
	this.faceEdges.push(firstEdge);
}

THREE.QuadEdgeMesh.prototype.finishEdges = function() {
	var edges = this.edges;
	var edgeCount = edges.length;

	var masterEdgeCount = 0;
	var vertEdges = new Array(this.vertCount);

	for (var i = 0; i < edgeCount; i++) {
		var edge = edges[i];

		edge.vertNext = edge.facePrev.opposite;
		if (edge.opposite)
			edge.vertPrev = edge.opposite.faceNext;

		vertEdges[edge.vert0] = edge;
		
		if (edge.opposite == null || !edge.opposite.master) {
			edge.master = true;
			edge.index = masterEdgeCount;
			if (edge.opposite)
				edge.opposite.index = masterEdgeCount;
			masterEdgeCount++;
		}
	}

	this.edgeCount = masterEdgeCount;
	this.vertEdges = vertEdges;
}

THREE.QuadEdgeMesh.prototype.subdivide = function() {
	var sub = new THREE.QuadEdgeMesh();

	var faceEdges = this.faceEdges;
	var faceCount = faceEdges.length;

	var firstEdgePoint = faceCount;
	var firstVertPoint = firstEdgePoint + this.edgeCount;

	// Build new half-edges for each face.
	for (var i = 0; i < faceCount; i++) {
		var firstEdge = faceEdges[i];

		var edge = firstEdge;
		do {
			var subFaceIndex = sub.faceEdges.length;

			var facePoint = i;
			var edgePoint0 = firstEdgePoint + edge.facePrev.index;
			var vertPoint = firstVertPoint + edge.vert0;
			var edgePoint1 = firstEdgePoint + edge.index;
			
			var subEdge0 = new HalfEdge(subFaceIndex, facePoint, edgePoint0);
			var subEdge1 = new HalfEdge(subFaceIndex, edgePoint0, vertPoint);
			var subEdge2 = new HalfEdge(subFaceIndex, vertPoint, edgePoint1);
			var subEdge3 = new HalfEdge(subFaceIndex, edgePoint1, facePoint);

			subEdge0.faceNext = subEdge1;
			subEdge1.faceNext = subEdge2;
			subEdge2.faceNext = subEdge3;
			subEdge3.faceNext = subEdge0;

			subEdge0.facePrev = subEdge3;
			subEdge1.facePrev = subEdge0;
			subEdge2.facePrev = subEdge1;
			subEdge3.facePrev = subEdge2;
			
			sub.edges.push(subEdge0, subEdge1, subEdge2, subEdge3);
			
			sub.faceEdges.push(subEdge0);
			
			// Create links between the two levels' topology.
			edge.facePrev.sub1 = subEdge1;
			edge.sub0 = subEdge2;
			edge.inner = subEdge3;
			subEdge0.outer = edge.facePrev;
			
			edge = edge.faceNext;
		} while (edge != firstEdge);
	}
	
	// With all edges added, link internal edges to their opposites using the
	// topological links we created before.
	for (var i = 0; i < faceCount; i++) {
		var firstEdge = faceEdges[i];

		var edge = firstEdge;
		do {
			edge.inner.opposite = edge.faceNext.inner.faceNext;
			edge.inner.opposite.opposite = edge.inner;
			
			if (edge.opposite) {
				edge.sub0.opposite = edge.opposite.sub1;
				edge.sub0.opposite.opposite = edge.sub0;
				edge.sub1.opposite = edge.opposite.sub0;
				edge.sub1.opposite.opposite = edge.sub1;
			}
			
			edge = edge.faceNext;
		} while (edge != firstEdge);
	}

	sub.vertCount = faceCount + this.edgeCount + this.vertCount;
	
	// Allocate edge IDs and connect edges to vertices.
	sub.finishEdges();
	
	return sub;
}


THREE.FacePoint = 0;
THREE.SmoothEdgePoint = 1;
THREE.BorderEdgePoint = 2;
THREE.SmoothVertPoint = 3;
THREE.BorderVertPoint = 4;
THREE.CornerVertPoint = 5;

THREE.SubD = function(parameters) {
	parameters = parameters || {}
	this.verts = parameters.verts || [];
	this.faces = parameters.faces || [];

	if ("vertKinds" in parameters) {
		this.vertKinds = parameters.vertKinds;
	} else {
		this.vertKinds = [];
		for (var i = 0; i < this.verts.length; i++)
			this.vertKinds[i] = THREE.SmoothVertPoint;
	}

	this.qe = parameters.qe || null;
}

THREE.SubD.prototype.makeGeometry = function(parameters) {
	parameters = parameters || {}
	var flipWinding = parameters["flipWinding"] || false;

	var verts = this.verts;
	var normals = this.normals;
	var faces = this.faces;
	var faceCount = this.faces.length;

	var triVertCount = 0;
	for (var i = 0; i < faceCount; i++)
		triVertCount += (faces[i].length - 2) * 3;

	//var geometry = new THREE.Geometry2(triVertCount);
    var geometry= new THREE.BufferGeometry();
    /*geometry.addAttribute( 'position', new Float32Array( triVertCount * 3 ), 3 );
    geometry.addAttribute( 'normal', new Float32Array( size * 3 ), 3 );
    geometry.addAttribute( 'uv', new Float32Array( size * 2 ), 2 );
    */
	//var geometryVerts = geometry.vertices;
	//var geometryNormals = geometry.normals;
    var geometryVerts = new Float32Array( triVertCount * 3 );
    var geometryNormals = new Float32Array( triVertCount * 3 );
	var offset = 0;
	var vert;

	// NB: This triangulation algorithm is insufficient for many kinds of polygons.  
	// See http://www.geometrictools.com/Documentation/TriangulationByEarClipping.pdf for a better one.
	for (var i = 0; i < faceCount; i++) {
		var face = faces[i];
		var faceValence = face.length;

		if (flipWinding) {
			for (var j = 2; j < faceValence; j++) {
				vertIndex = face[0];

				vert = verts[vertIndex];
				geometryVerts[offset + 0] = vert.x;
				geometryVerts[offset + 1] = vert.y;
				geometryVerts[offset + 2] = vert.z;

				normal = normals[vertIndex];
				geometryNormals[offset + 0] = normal.x;
				geometryNormals[offset + 1] = normal.y;
				geometryNormals[offset + 2] = normal.z;

				vertIndex = face[j];

				vert = verts[vertIndex];
				geometryVerts[offset + 3] = vert.x;
				geometryVerts[offset + 4] = vert.y;
				geometryVerts[offset + 5] = vert.z;

				normal = normals[vertIndex];
				geometryNormals[offset + 3] = normal.x;
				geometryNormals[offset + 4] = normal.y;
				geometryNormals[offset + 5] = normal.z;
			
				vertIndex = face[j - 1];

				vert = verts[vertIndex];
				geometryVerts[offset + 6] = vert.x;
				geometryVerts[offset + 7] = vert.y;
				geometryVerts[offset + 8] = vert.z;

				normal = normals[vertIndex];
				geometryNormals[offset + 6] = normal.x;
				geometryNormals[offset + 7] = normal.y;
				geometryNormals[offset + 8] = normal.z;

				offset += 9;
			}
		} else {
			for (var j = 2; j < faceValence; j++) {
				vertIndex = face[0];

				vert = verts[vertIndex];
				geometryVerts[offset + 0] = vert.x;
				geometryVerts[offset + 1] = vert.y;
				geometryVerts[offset + 2] = vert.z;

				normal = normals[vertIndex];
				geometryNormals[offset + 0] = normal.x;
				geometryNormals[offset + 1] = normal.y;
				geometryNormals[offset + 2] = normal.z;

				vertIndex = face[j - 1];

				vert = verts[vertIndex];
				geometryVerts[offset + 3] = vert.x;
				geometryVerts[offset + 4] = vert.y;
				geometryVerts[offset + 5] = vert.z;

				normal = normals[vertIndex];
				geometryNormals[offset + 3] = normal.x;
				geometryNormals[offset + 4] = normal.y;
				geometryNormals[offset + 5] = normal.z;
			
				vertIndex = face[j];

				vert = verts[vertIndex];
				geometryVerts[offset + 6] = vert.x;
				geometryVerts[offset + 7] = vert.y;
				geometryVerts[offset + 8] = vert.z;

				normal = normals[vertIndex];
				geometryNormals[offset + 6] = normal.x;
				geometryNormals[offset + 7] = normal.y;
				geometryNormals[offset + 8] = normal.z;

				offset += 9;
			}
		}
	}
    geometry.addAttribute( 'position', new THREE.BufferAttribute( geometryVerts, 3 ) );
    geometry.addAttribute( 'normal', new THREE.BufferAttribute( geometryNormals, 3 ) );
    geometry.computeBoundingSphere();
	return geometry;
}

THREE.SubD.prototype.makeWireGeometry = function() {
	var verts = this.verts;
	var faces = this.faces;
	var faceCount = this.faces.length;

	var lineVertCount = 0;
	for (var i = 0; i < faceCount; i++)
		lineVertCount += (faces[i].length - 2) * 4; // XXX why *4 is needed is unclear, should be *2

	//var geometry = new THREE.Geometry2(lineVertCount);
    var geometry = new THREE.BufferGeometry();
	//var vertices = geometry.vertices;
    var vertices = new Float32Array( lineVertCount * 3 );
    var indices=[];
	var offset = 0;
	var vert;

	for (var i = 0; i < faceCount; i++) {
		var face = this.faces[i];
		var faceValence = face.length;

		for (var j = 0; j < faceValence; j++) {
			vert = verts[face[j]];
			vertices[offset++] = vert.x;
			vertices[offset++] = vert.y;
			vertices[offset++] = vert.z;
            
			vert = verts[face[(j + 1) % faceValence]];
			vertices[offset++] = vert.x;
			vertices[offset++] = vert.y;
			vertices[offset++] = vert.z;
		}
	}
    geometry.addAttribute( 'position', new THREE.BufferAttribute( vertices, 3 ) );
    for(var j=0;j<lineVertCount-1;j++){
        indices.push(j);
        indices.push(j+1);
    }
    geometry.setIndex(new THREE.BufferAttribute(new Uint16Array(indices), 1));
    geometry.computeBoundingSphere();
	return geometry;
}

THREE.SubD.prototype.calculateNormals = function() {
	var faces = this.faces;
	var faceCount = faces.length;
	var verts = this.verts;
	var vertCount = verts.length;

	var normals = new Array(this.verts.length);

	for (var i = 0; i < vertCount; i++)
		normals[i] = new THREE.Vector3();

	var vert0 = new THREE.Vector3();
	var vert1 = new THREE.Vector3();
	var vert2 = new THREE.Vector3();

	var v01 = new THREE.Vector3();
	var v02 = new THREE.Vector3();
	var tn = new THREE.Vector3();
	var fn = new THREE.Vector3();

	for (var i = 0; i < faceCount; i++) {
		var face = faces[i];
		var faceVertCount = face.length;

		fn.set(0, 0, 0);

		// NB: This triangulation algorithm is insufficient for many kinds of polygons.  
		// See http://www.geometrictools.com/Documentation/TriangulationByEarClipping.pdf for a better one.
		for (var j = 2; j < faceVertCount; j++) {
			vert0 = verts[face[0]];
			vert1 = verts[face[j - 1]];
			vert2 = verts[face[j]];

			v01.subVectors(vert1, vert0);
			v02.subVectors(vert2, vert0);

			tn.crossVectors(v01, v02);
			fn.add(tn);
		}

		for (var j = 0; j < faceVertCount; j++)
			normals[face[j]].add(fn);
	}

	for (var i = 0; i < vertCount; i++)
		normals[i].normalize();

	this.normals = normals;
}

THREE.SubD.prototype.smooth = function(opts) {
	opts = opts || [];
	var lerp = opts.lerp || 0.0;

	var qe;
	if (this.qe) {
		qe = this.qe.subdivide();
	} else {
		qe = new THREE.QuadEdgeMesh(this);
	}

	var verts = [];
	var vertKinds = [];

	// Calculate face points; centroid of face verts.
	for (var i = 0; i < qe.faceEdges.length; i++) {
		var firstEdge = qe.faceEdges[i];

		var facePoint = new THREE.Vector3();
		var valence = 0;

		var edge = firstEdge;
		do {
			facePoint.add(this.verts[edge.vert0]);
			valence++;
			edge = edge.faceNext;
		} while (edge != firstEdge);

		facePoint.divideScalar(valence);

		vertKinds.push(THREE.FacePoint);

		verts.push(facePoint);
	}

	// Calculate edge points; average of endpoints and adjacent face points for smooth,
	// average of end points if a border.
	for (var i = 0; i < qe.edges.length; i++) {
		var edge = qe.edges[i];

		if (!edge.master)
			continue;
			
		var edgePoint = new THREE.Vector3();
		edgePoint.copy(this.verts[edge.vert0]);
		edgePoint.add(this.verts[edge.vert1]);

		var basePoint = edgePoint.clone().divideScalar(2.0);

		if (edge.opposite) {
			edgePoint.add(verts[edge.faceIndex]);
			edgePoint.add(verts[edge.opposite.faceIndex]);
			edgePoint.divideScalar(4.0);

			vertKinds.push(THREE.SmoothEdgePoint);
		} else {
			edgePoint.divideScalar(2.0);

			vertKinds.push(THREE.BorderEdgePoint);
		}

		edgePoint.lerp(basePoint, lerp);

		verts.push(edgePoint);
	}

	// Calculate vertex points; weighted average of adjacent vertices and face points,
	// unless border or corner rules apply.
	for (var i = 0; i < qe.vertCount; i++) {
		var firstEdge = qe.vertEdges[i];

		// Orphaned verts sometimes exist in source models, but will be skipped by the QuadEdgeMesh.
		// Simply pass them along here to preserve indexing.
		if (!firstEdge) {
			vertKinds.push(THREE.CornerVertPoint);
			verts.push(this.verts[i]);
			continue;
		}

		// Rewind to the first edge on the vertex.
		var edge = firstEdge;
		while (edge.vertPrev) {
			edge = edge.vertPrev;
			if (edge == firstEdge)
				break;
		}
		firstEdge = edge;

		var borderEdges = [];
		var valence = 0;

		edge = firstEdge;
		do {
			if (edge.opposite == null)
				borderEdges.push(edge);
			valence += 1;
			// At the last edge of a border vertex, step backwards around its
			// face to find the edge which ends at the border vertex.
			if (edge.vertNext == null) {
				borderEdges.push(edge.facePrev);
				valence += 1;
				break;
			}
			edge = edge.vertNext;
		} while (edge != firstEdge);

		var vertPoint = new THREE.Vector3();
		vertPoint.copy(this.verts[i]);

		var basePoint = this.verts[i].clone();

		if (borderEdges.length > 2 || valence == 1) {
			vertKinds.push(THREE.CornerVertPoint);
		} else if (borderEdges.length == 2) {
			var borderVert0 = new THREE.Vector3();
			borderVert0.copy(this.verts[borderEdges[0].vert1]);

			var borderVert1 = new THREE.Vector3();
			borderVert1.copy(this.verts[borderEdges[1].vert0]);

			vertPoint.multiplyScalar(6.0/8.0)
			borderVert0.multiplyScalar(1.0/8.0);
			borderVert1.multiplyScalar(1.0/8.0);

			vertPoint.add(borderVert0);
			vertPoint.add(borderVert1);

			vertKinds.push(THREE.BorderVertPoint);
		} else {
			var neighborSum = new THREE.Vector3();
			var faceSum = new THREE.Vector3();

			var edge = firstEdge;
			do {
				neighborSum.add(this.verts[edge.vert1]);
				faceSum.add(verts[edge.faceIndex]);
				edge = edge.vertNext;
			} while (edge != firstEdge);

			var baseScalar = (valence - 2.0) / valence;
			var neighborScalar = 1.0 / (valence * valence);

			vertPoint.multiplyScalar(baseScalar);
			neighborSum.multiplyScalar(neighborScalar);
			faceSum.multiplyScalar(neighborScalar);

			vertPoint.add(neighborSum);
			vertPoint.add(faceSum);

			vertKinds.push(THREE.SmoothVertPoint);
		}

		vertPoint.lerp(basePoint, lerp);

		verts.push(vertPoint);
	}

	// Build the new faces from the vertices we just created.
	var faces = [];

	var firstEdgePoint = qe.faceEdges.length;
	var firstVertPoint = firstEdgePoint + qe.edgeCount;

	for (var i = 0; i < qe.faceEdges.length; i++) {
		var firstEdge = qe.faceEdges[i];

		var edge = firstEdge;
		do {
			faces.push([
				i,
				firstEdgePoint + edge.facePrev.index,
				firstVertPoint + edge.vert0,
				firstEdgePoint + edge.index
			]);
			edge = edge.faceNext;
		} while (edge != firstEdge);
	}

	return new THREE.SubD({ 
		'verts': verts, 
		'vertKinds': vertKinds,
		'faces': faces,
		'qe': qe
	});
}

/**
 * @author mrdoob / http://mrdoob.com/
 * @author wadeb / http://wadeb.com/
 */

THREE.SubDOBJLoader = function ( manager ) {

	this.manager = ( manager !== undefined ) ? manager : THREE.DefaultLoadingManager;

};

THREE.SubDOBJLoader.prototype = {

	constructor: THREE.SubDOBJLoader,

	load: function ( url, onLoad, onProgress, onError ) {

		var scope = this;

		var loader = new THREE.XHRLoader( scope.manager );
		loader.setCrossOrigin( this.crossOrigin );
		loader.load( url, function ( text ) {

			onLoad( scope.parse( text ) );

		} );

	},

	parse: function ( text ) {

		var verts = [];
		var faces = [];

		function parseVertexIndex( value ) {

			var index = parseInt( value );

			return ( index >= 0 ? index - 1 : index + mesh.verts.length );

		}

		function parseUVIndex( value ) {

			var index = parseInt( value );

			return ( index >= 0 ? index - 1 : index + mesh.uvs.length );

		}

		// v float float float

		var vertex_pattern = /v( +[\d|\.|\+|\-|e]+)( +[\d|\.|\+|\-|e]+)( +[\d|\.|\+|\-|e]+)/;

		// vn float float float

		var normal_pattern = /vn( +[\d|\.|\+|\-|e]+)( +[\d|\.|\+|\-|e]+)( +[\d|\.|\+|\-|e]+)/;

		// vt float float

		var uv_pattern = /vt( +[\d|\.|\+|\-|e]+)( +[\d|\.|\+|\-|e]+)/;

		// f vertex/uv/normal vertex/uv/normal vertex/uv/normal ...

		var face_vert_pattern = / +(-?\d+)(\/(-?\d+)?)?(\/(-?\d+)?)?/;

		//

		var lines = text.split( '\n' );

		for ( var i = 0; i < lines.length; i ++ ) {

			var line = lines[ i ];
			line = line.trim();

			var result;

			if ( line.length === 0 || line.charAt( 0 ) === '#' ) {

				continue;

			} else if ( ( result = vertex_pattern.exec( line ) ) !== null ) {

				// ["v 1.0 2.0 3.0", "1.0", "2.0", "3.0"]

				verts.push(
					new THREE.Vector3(
						parseFloat( result[ 1 ] ),
						parseFloat( result[ 2 ] ),
						parseFloat( result[ 3 ] )
					)
				);

			} else if ( ( result = normal_pattern.exec( line ) ) !== null ) {

				// ["vn 1.0 2.0 3.0", "1.0", "2.0", "3.0"]

			} else if ( ( result = uv_pattern.exec( line ) ) !== null ) {

				// ["vt 0.1 0.2", "0.1", "0.2"]

				// mesh.uvs.push(
				// 	parseFloat( result[ 1 ] ),
				// 	parseFloat( result[ 2 ] )
				// );

			} else if ( /^f /.test( line ) ) {

				var faceVerts = [];
				// var faceUVs = [];

				line = line.substring( 1 );

				while ( ( result = face_vert_pattern.exec( line ) ) != null ) {

					// [" 0/1/2", "0", "/1", "1", "/2", "2"]

					faceVerts.push( parseVertexIndex( result[ 1 ] ) );
					// faceUVs.push( parseUVIndex( result[ 3 ] ) );

					line = line.substring( result[ 0 ].length );
				}

				faces.push( faceVerts );

			} else if ( /^o /.test( line ) ) {

				// object

			} else if ( /^g /.test( line ) ) {

				// group

			} else if ( /^usemtl /.test( line ) ) {

				// material

			} else if ( /^mtllib /.test( line ) ) {

				// mtl file

			} else if ( /^s /.test( line ) ) {

				// smooth shading

			} else {

				// console.log( "THREE.OBJLoader: Unhandled line " + line );

			}

		}

		return new THREE.SubD({ 'verts': verts, 'faces': faces });

	}

};
