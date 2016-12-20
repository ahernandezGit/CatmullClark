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
    this.materials = null;

	this.regexp = {
		// v float float float
		vertex_pattern           : /^v\s+([\d|\.|\+|\-|e|E]+)\s+([\d|\.|\+|\-|e|E]+)\s+([\d|\.|\+|\-|e|E]+)/,
		// vn float float float
		normal_pattern           : /^vn\s+([\d|\.|\+|\-|e|E]+)\s+([\d|\.|\+|\-|e|E]+)\s+([\d|\.|\+|\-|e|E]+)/,
		// vt float float
		uv_pattern               : /^vt\s+([\d|\.|\+|\-|e|E]+)\s+([\d|\.|\+|\-|e|E]+)/,
		// f vertex vertex vertex
		face_vertex              : /^f\s+(-?\d+)\s+(-?\d+)\s+(-?\d+)(?:\s+(-?\d+))?/, 
		// f vertex/uv vertex/uv vertex/uv
		face_vertex_uv           : /^f\s+(-?\d+)\/(-?\d+)\s+(-?\d+)\/(-?\d+)\s+(-?\d+)\/(-?\d+)(?:\s+(-?\d+)\/(-?\d+))?/,
		// f vertex/uv/normal vertex/uv/normal vertex/uv/normal
		face_vertex_uv_normal    : /^f\s+(-?\d+)\/(-?\d+)\/(-?\d+)\s+(-?\d+)\/(-?\d+)\/(-?\d+)\s+(-?\d+)\/(-?\d+)\/(-?\d+)(?:\s+(-?\d+)\/(-?\d+)\/(-?\d+))?/,
		// f vertex//normal vertex//normal vertex//normal
		face_vertex_normal       : /^f\s+(-?\d+)\/\/(-?\d+)\s+(-?\d+)\/\/(-?\d+)\s+(-?\d+)\/\/(-?\d+)(?:\s+(-?\d+)\/\/(-?\d+))?/,
        face_vert_pattern        : / +(-?\d+)(\/(-?\d+)?)?(\/(-?\d+)?)?/,
		// o object_name | g group_name
		object_pattern           : /^[og]\s*(.+)?/,
		// s boolean
		smoothing_pattern        : /^s\s+(\d+|on|off)/,
		// mtllib file_reference
		material_library_pattern : /^mtllib /,
		// usemtl material_name
		material_use_pattern     : /^usemtl /
	};
};

/*THREE.SubDOBJLoader.prototype = {

	constructor: THREE.SubDOBJLoader,

	load: function ( url, onLoad, onProgress, onError ) {

		var scope = this;

		var loader = new THREE.XHRLoader( scope.manager );
		loader.setPath( this.path );
		loader.load( url, function ( text ) {

			onLoad( scope.parse( text ) );

		}, onProgress, onError );

	},

	setPath: function ( value ) {

		this.path = value;

	},

	setMaterials: function ( materials ) {

		this.materials = materials;

	},

	_createParserState : function () {

		var state = {
			objects  : [],
			object   : {},

			vertices : [],
			normals  : [],
			uvs      : [],

			materialLibraries : [],

			startObject: function ( name, fromDeclaration ) {

				// If the current object (initial from reset) is not from a g/o declaration in the parsed
				// file. We need to use it for the first parsed g/o to keep things in sync.
				if ( this.object && this.object.fromDeclaration === false ) {

					this.object.name = name;
					this.object.fromDeclaration = ( fromDeclaration !== false );
					return;

				}

				var previousMaterial = ( this.object && typeof this.object.currentMaterial === 'function' ? this.object.currentMaterial() : undefined );

				if ( this.object && typeof this.object._finalize === 'function' ) {

					this.object._finalize( true );

				}

				this.object = {
					name : name || '',
					fromDeclaration : ( fromDeclaration !== false ),

					geometry : {
						vertices : [],
						normals  : [],
						uvs      : []
					},
					materials : [],
					smooth : true,

					startMaterial : function( name, libraries ) {

						var previous = this._finalize( false );

						// New usemtl declaration overwrites an inherited material, except if faces were declared
						// after the material, then it must be preserved for proper MultiMaterial continuation.
						if ( previous && ( previous.inherited || previous.groupCount <= 0 ) ) {

							this.materials.splice( previous.index, 1 );

						}

						var material = {
							index      : this.materials.length,
							name       : name || '',
							mtllib     : ( Array.isArray( libraries ) && libraries.length > 0 ? libraries[ libraries.length - 1 ] : '' ),
							smooth     : ( previous !== undefined ? previous.smooth : this.smooth ),
							groupStart : ( previous !== undefined ? previous.groupEnd : 0 ),
							groupEnd   : -1,
							groupCount : -1,
							inherited  : false,

							clone : function( index ) {
								var cloned = {
									index      : ( typeof index === 'number' ? index : this.index ),
									name       : this.name,
									mtllib     : this.mtllib,
									smooth     : this.smooth,
									groupStart : 0,
									groupEnd   : -1,
									groupCount : -1,
									inherited  : false
								};
								cloned.clone = this.clone.bind(cloned);
								return cloned;
							}
						};

						this.materials.push( material );

						return material;

					},

					currentMaterial : function() {

						if ( this.materials.length > 0 ) {
							return this.materials[ this.materials.length - 1 ];
						}

						return undefined;

					},

					_finalize : function( end ) {

						var lastMultiMaterial = this.currentMaterial();
						if ( lastMultiMaterial && lastMultiMaterial.groupEnd === -1 ) {

							lastMultiMaterial.groupEnd = this.geometry.vertices.length / 3;
							lastMultiMaterial.groupCount = lastMultiMaterial.groupEnd - lastMultiMaterial.groupStart;
							lastMultiMaterial.inherited = false;

						}

						// Ignore objects tail materials if no face declarations followed them before a new o/g started.
						if ( end && this.materials.length > 1 ) {

							for ( var mi = this.materials.length - 1; mi >= 0; mi-- ) {
								if ( this.materials[mi].groupCount <= 0 ) {
									this.materials.splice( mi, 1 );
								}
							}

						}

						// Guarantee at least one empty material, this makes the creation later more straight forward.
						if ( end && this.materials.length === 0 ) {

							this.materials.push({
								name   : '',
								smooth : this.smooth
							});

						}

						return lastMultiMaterial;

					}
				};

				// Inherit previous objects material.
				// Spec tells us that a declared material must be set to all objects until a new material is declared.
				// If a usemtl declaration is encountered while this new object is being parsed, it will
				// overwrite the inherited material. Exception being that there was already face declarations
				// to the inherited material, then it will be preserved for proper MultiMaterial continuation.

				if ( previousMaterial && previousMaterial.name && typeof previousMaterial.clone === "function" ) {

					var declared = previousMaterial.clone( 0 );
					declared.inherited = true;
					this.object.materials.push( declared );

				}

				this.objects.push( this.object );

			},

			finalize : function() {

				if ( this.object && typeof this.object._finalize === 'function' ) {

					this.object._finalize( true );

				}

			},

			parseVertexIndex: function ( value, len ) {

				var index = parseInt( value, 10 );
				return ( index >= 0 ? index - 1 : index + len / 3 ) * 3;

			},

			parseNormalIndex: function ( value, len ) {

				var index = parseInt( value, 10 );
				return ( index >= 0 ? index - 1 : index + len / 3 ) * 3;

			},

			parseUVIndex: function ( value, len ) {

				var index = parseInt( value, 10 );
				return ( index >= 0 ? index - 1 : index + len / 2 ) * 2;

			},

			addVertex: function ( a, b, c ) {

				var src = this.vertices;
				var dst = this.object.geometry.vertices;

				dst.push( src[ a + 0 ] );
				dst.push( src[ a + 1 ] );
				dst.push( src[ a + 2 ] );
				dst.push( src[ b + 0 ] );
				dst.push( src[ b + 1 ] );
				dst.push( src[ b + 2 ] );
				dst.push( src[ c + 0 ] );
				dst.push( src[ c + 1 ] );
				dst.push( src[ c + 2 ] );

			},

			addVertexLine: function ( a ) {

				var src = this.vertices;
				var dst = this.object.geometry.vertices;

				dst.push( src[ a + 0 ] );
				dst.push( src[ a + 1 ] );
				dst.push( src[ a + 2 ] );

			},

			addNormal : function ( a, b, c ) {

				var src = this.normals;
				var dst = this.object.geometry.normals;

				dst.push( src[ a + 0 ] );
				dst.push( src[ a + 1 ] );
				dst.push( src[ a + 2 ] );
				dst.push( src[ b + 0 ] );
				dst.push( src[ b + 1 ] );
				dst.push( src[ b + 2 ] );
				dst.push( src[ c + 0 ] );
				dst.push( src[ c + 1 ] );
				dst.push( src[ c + 2 ] );

			},

			addUV: function ( a, b, c ) {

				var src = this.uvs;
				var dst = this.object.geometry.uvs;

				dst.push( src[ a + 0 ] );
				dst.push( src[ a + 1 ] );
				dst.push( src[ b + 0 ] );
				dst.push( src[ b + 1 ] );
				dst.push( src[ c + 0 ] );
				dst.push( src[ c + 1 ] );

			},

			addUVLine: function ( a ) {

				var src = this.uvs;
				var dst = this.object.geometry.uvs;

				dst.push( src[ a + 0 ] );
				dst.push( src[ a + 1 ] );

			},

			addFace: function ( a, b, c, d, ua, ub, uc, ud, na, nb, nc, nd ) {

				var vLen = this.vertices.length;

				var ia = this.parseVertexIndex( a, vLen );
				var ib = this.parseVertexIndex( b, vLen );
				var ic = this.parseVertexIndex( c, vLen );
				var id;

				if ( d === undefined ) {

					this.addVertex( ia, ib, ic );

				} else {

					id = this.parseVertexIndex( d, vLen );

					this.addVertex( ia, ib, id );
					this.addVertex( ib, ic, id );

				}

				if ( ua !== undefined ) {

					var uvLen = this.uvs.length;

					ia = this.parseUVIndex( ua, uvLen );
					ib = this.parseUVIndex( ub, uvLen );
					ic = this.parseUVIndex( uc, uvLen );

					if ( d === undefined ) {

						this.addUV( ia, ib, ic );

					} else {

						id = this.parseUVIndex( ud, uvLen );

						this.addUV( ia, ib, id );
						this.addUV( ib, ic, id );

					}

				}

				if ( na !== undefined ) {

					// Normals are many times the same. If so, skip function call and parseInt.
					var nLen = this.normals.length;
					ia = this.parseNormalIndex( na, nLen );

					ib = na === nb ? ia : this.parseNormalIndex( nb, nLen );
					ic = na === nc ? ia : this.parseNormalIndex( nc, nLen );

					if ( d === undefined ) {

						this.addNormal( ia, ib, ic );

					} else {

						id = this.parseNormalIndex( nd, nLen );

						this.addNormal( ia, ib, id );
						this.addNormal( ib, ic, id );

					}

				}

			},

			addLineGeometry: function ( vertices, uvs ) {

				this.object.geometry.type = 'Line';

				var vLen = this.vertices.length;
				var uvLen = this.uvs.length;

				for ( var vi = 0, l = vertices.length; vi < l; vi ++ ) {

					this.addVertexLine( this.parseVertexIndex( vertices[ vi ], vLen ) );

				}

				for ( var uvi = 0, l = uvs.length; uvi < l; uvi ++ ) {

					this.addUVLine( this.parseUVIndex( uvs[ uvi ], uvLen ) );

				}

			}

		};

		state.startObject( '', false );

		return state;

	},

	parse: function ( text ) {
        var faces = [];
        
		var state = this._createParserState();

        function parseVertexIndex( value ) {

			var index = parseInt( value );

			return ( index >= 0 ? index - 1 : index + state.vertices.length/3 )*3;

		}
		if ( text.indexOf( '\r\n' ) !== - 1 ) {

			// This is faster than String.split with regex that splits on both
			text = text.replace( /\r\n/g, '\n' );

		}

		if ( text.indexOf( '\\\n' ) !== - 1) {

			// join lines separated by a line continuation character (\)
			text = text.replace( /\\\n/g, '' );

		}

		var lines = text.split( '\n' );
		var line = '', lineFirstChar = '', lineSecondChar = '';
		var lineLength = 0;
		var result = [];

		// Faster to just trim left side of the line. Use if available.
		var trimLeft = ( typeof ''.trimLeft === 'function' );

		for ( var i = 0, l = lines.length; i < l; i ++ ) {

			line = lines[ i ];

			line = trimLeft ? line.trimLeft() : line.trim();

			lineLength = line.length;

			if ( lineLength === 0 ) continue;

			lineFirstChar = line.charAt( 0 );

			// @todo invoke passed in handler if any
			if ( lineFirstChar === '#' ) continue;

			if ( lineFirstChar === 'v' ) {

				lineSecondChar = line.charAt( 1 );

				if ( lineSecondChar === ' ' && ( result = this.regexp.vertex_pattern.exec( line ) ) !== null ) {

					// 0                  1      2      3
					// ["v 1.0 2.0 3.0", "1.0", "2.0", "3.0"]

					state.vertices.push(
						parseFloat( result[ 1 ] ),
						parseFloat( result[ 2 ] ),
						parseFloat( result[ 3 ] )
					);

				} else if ( lineSecondChar === 'n' && ( result = this.regexp.normal_pattern.exec( line ) ) !== null ) {

					// 0                   1      2      3
					// ["vn 1.0 2.0 3.0", "1.0", "2.0", "3.0"]

					state.normals.push(
						parseFloat( result[ 1 ] ),
						parseFloat( result[ 2 ] ),
						parseFloat( result[ 3 ] )
					);

				} else if ( lineSecondChar === 't' && ( result = this.regexp.uv_pattern.exec( line ) ) !== null ) {

					// 0               1      2
					// ["vt 0.1 0.2", "0.1", "0.2"]

					state.uvs.push(
						parseFloat( result[ 1 ] ),
						parseFloat( result[ 2 ] )
					);

				} else {

					throw new Error( "Unexpected vertex/normal/uv line: '" + line  + "'" );

				}

			} else if ( lineFirstChar === "f" ) {
                
                var faceVerts = [];
				// var faceUVs = [];
                var line2=line; 
                console.log(line2);
				line2 = line2.substring( 1 );

				while ( ( result = this.regexp.face_vert_pattern.exec( line2 ) ) !== null ) {

					// [" 0/1/2", "0", "/1", "1", "/2", "2"]

					faceVerts.push(parseVertexIndex( result[ 1 ]) );
					// faceUVs.push( parseUVIndex( result[ 3 ] ) );

					line2 = line2.substring( result[ 0 ].length );
				}
				faces.push( faceVerts );
				if ( ( result = this.regexp.face_vertex_uv_normal.exec( line ) ) !== null ) {

					// f vertex/uv/normal vertex/uv/normal vertex/uv/normal
					// 0                        1    2    3    4    5    6    7    8    9   10         11         12
					// ["f 1/1/1 2/2/2 3/3/3", "1", "1", "1", "2", "2", "2", "3", "3", "3", undefined, undefined, undefined]
                   // faces.push([parseFloat(result[1]), parseFloat(result[4]), parseFloat(result[7]),parseFloat(result[ 10])]);
					state.addFace(
						result[ 1 ], result[ 4 ], result[ 7 ], result[ 10 ],
						result[ 2 ], result[ 5 ], result[ 8 ], result[ 11 ],
						result[ 3 ], result[ 6 ], result[ 9 ], result[ 12 ]
					);

				} else if ( ( result = this.regexp.face_vertex_uv.exec( line ) ) !== null ) {

					// f vertex/uv vertex/uv vertex/uv
					// 0                  1    2    3    4    5    6   7          8
					// ["f 1/1 2/2 3/3", "1", "1", "2", "2", "3", "3", undefined, undefined]
                    //faces.push([parseFloat(result[1]), parseFloat(result[3]), parseFloat(result[5]), parseFloat(result[ 7])]);
					state.addFace(
						result[ 1 ], result[ 3 ], result[ 5 ], result[ 7 ],
						result[ 2 ], result[ 4 ], result[ 6 ], result[ 8 ]
					);

				} else if ( ( result = this.regexp.face_vertex_normal.exec( line ) ) !== null ) {

					// f vertex//normal vertex//normal vertex//normal
					// 0                     1    2    3    4    5    6   7          8
					// ["f 1//1 2//2 3//3", "1", "1", "2", "2", "3", "3", undefined, undefined]
                    //faces.push([parseFloat(result[1]),parseFloat(result[3]), parseFloat(result[5]), parseFloat(result[ 7])]);
					state.addFace(
						result[ 1 ], result[ 3 ], result[ 5 ], result[ 7 ],
						undefined, undefined, undefined, undefined,
						result[ 2 ], result[ 4 ], result[ 6 ], result[ 8 ]
					);

				} else if ( ( result = this.regexp.face_vertex.exec( line ) ) !== null ) {

					// f vertex vertex vertex
					// 0            1    2    3   4
					// ["f 1 2 3", "1", "2", "3", undefined]
                    //faces.push([parseFloat(result[1]), parseFloat(result[2]),parseFloat(result[3]), parseFloat(result[ 4])]);
					state.addFace(
						result[ 1 ], result[ 2 ], result[ 3 ], result[ 4 ]
					);

				} else {

					throw new Error( "Unexpected face line: '" + line  + "'" );

				}

			} else if ( lineFirstChar === "l" ) {

				var lineParts = line.substring( 1 ).trim().split( " " );
				var lineVertices = [], lineUVs = [];

				if ( line.indexOf( "/" ) === - 1 ) {

					lineVertices = lineParts;

				} else {

					for ( var li = 0, llen = lineParts.length; li < llen; li ++ ) {

						var parts = lineParts[ li ].split( "/" );

						if ( parts[ 0 ] !== "" ) lineVertices.push( parts[ 0 ] );
						if ( parts[ 1 ] !== "" ) lineUVs.push( parts[ 1 ] );

					}

				}
				state.addLineGeometry( lineVertices, lineUVs );

			} else if ( ( result = this.regexp.object_pattern.exec( line ) ) !== null ) {

				// o object_name
				// or
				// g group_name

				// WORKAROUND: https://bugs.chromium.org/p/v8/issues/detail?id=2869
				// var name = result[ 0 ].substr( 1 ).trim();
				var name = ( " " + result[ 0 ].substr( 1 ).trim() ).substr( 1 );

				state.startObject( name );

			} else if ( this.regexp.material_use_pattern.test( line ) ) {

				// material

				state.object.startMaterial( line.substring( 7 ).trim(), state.materialLibraries );

			} else if ( this.regexp.material_library_pattern.test( line ) ) {

				// mtl file

				state.materialLibraries.push( line.substring( 7 ).trim() );

			} else if ( ( result = this.regexp.smoothing_pattern.exec( line ) ) !== null ) {

				// smooth shading

				// @todo Handle files that have varying smooth values for a set of faces inside one geometry,
				// but does not define a usemtl for each face set.
				// This should be detected and a dummy material created (later MultiMaterial and geometry groups).
				// This requires some care to not create extra material on each smooth value for "normal" obj files.
				// where explicit usemtl defines geometry groups.
				// Example asset: examples/models/obj/cerberus/Cerberus.obj

				var value = result[ 1 ].trim().toLowerCase();
				state.object.smooth = ( value === '1' || value === 'on' );

				var material = state.object.currentMaterial();
				if ( material ) {

					material.smooth = state.object.smooth;

				}

			} else {

				// Handle null terminated files without exception
				if ( line === '\0' ) continue;

				throw new Error( "Unexpected line: '" + line  + "'" );

			}

		}
		state.finalize();

		//var container = new THREE.Group();
		//container.materialLibraries = [].concat( state.materialLibraries );
        var meshes=[];
        
		for ( var i = 0, l = state.objects.length; i < l; i ++ ) {

			var object = state.objects[ i ];
			var geometry = object.geometry;
			var materials = object.materials;
			var isLine = ( geometry.type === 'Line' );
            //console.log(geometry.vertices.length);
			// Skip o/g line declarations that did not follow with any faces
			if ( geometry.vertices.length === 0 ) continue;

			var buffergeometry = new THREE.BufferGeometry();
            var easygeometry = new THREE.Geometry();    
			buffergeometry.addAttribute( 'position', new THREE.BufferAttribute( new Float32Array( geometry.vertices ), 3 ) );

			if ( geometry.normals.length > 0 ) {

				buffergeometry.addAttribute( 'normal', new THREE.BufferAttribute( new Float32Array( geometry.normals ), 3 ) );

			} else {

				buffergeometry.computeVertexNormals();

			}

			if ( geometry.uvs.length > 0 ) {

				buffergeometry.addAttribute( 'uv', new THREE.BufferAttribute( new Float32Array( geometry.uvs ), 2 ) );

			}
            
			// Create materials

			var createdMaterials = [];

			for ( var mi = 0, miLen = materials.length; mi < miLen ; mi++ ) {

				var sourceMaterial = materials[mi];
				var material = undefined;

				if ( this.materials !== null ) {

					material = this.materials.create( sourceMaterial.name );

					// mtl etc. loaders probably can't create line materials correctly, copy properties to a line material.
					if ( isLine && material && ! ( material instanceof THREE.LineBasicMaterial ) ) {

						var materialLine = new THREE.LineBasicMaterial();
						materialLine.copy( material );
						material = materialLine;

					}

				}

				if ( ! material ) {

					material = ( ! isLine ? new THREE.MeshPhongMaterial() : new THREE.LineBasicMaterial() );
					material.name = sourceMaterial.name;

				}

				material.shading = sourceMaterial.smooth ? THREE.SmoothShading : THREE.FlatShading;

				createdMaterials.push(material);

			}

			// Create mesh

			var mesh;

			if ( createdMaterials.length > 1 ) {

				for ( var mi = 0, miLen = materials.length; mi < miLen ; mi++ ) {

					var sourceMaterial = materials[mi];
					buffergeometry.addGroup( sourceMaterial.groupStart, sourceMaterial.groupCount, mi );

				}
                easygeometry.fromBufferGeometry( buffergeometry );
                if(state.objects.length!==1){
                    easygeometry.mergeVertices();
                    easygeometry.elementsNeedUpdate=true;
                    easygeometry.computeFaceNormals();
                    easygeometry.computeVertexNormals();
                }
				var multiMaterial = new THREE.MultiMaterial( createdMaterials );
				mesh = ( ! isLine ? new THREE.Mesh( easygeometry, multiMaterial ) : new THREE.LineSegments( easygeometry, multiMaterial ) );

			} else {
                easygeometry.fromBufferGeometry( buffergeometry );
                if(state.objects.length!==1){
                    easygeometry.mergeVertices();
                    easygeometry.elementsNeedUpdate=true;
                    easygeometry.computeFaceNormals();
                    easygeometry.computeVertexNormals();
                }
				mesh = ( ! isLine ? new THREE.Mesh( easygeometry, createdMaterials[ 0 ] ) : new THREE.LineSegments( easygeometry, createdMaterials[ 0 ] ) );
			}

			mesh.name = object.name;
            meshes.push(mesh);
			//container.add( mesh );

		}
        if(state.objects.length==1){
             console.log(easygeometry.vertices );
             console.log(faces);
             return new THREE.SubD({ 'verts': easygeometry.vertices , 'faces':faces });  
        } 
        else{
            var fgeometry = mergeMeshes(meshes);
            fgeometry.normalize();
            return new THREE.SubD({ 'verts':fgeometry.vertices, 'faces':fgeometry.faces});  
        }

	}
};*/
THREE.SubDOBJLoader.prototype = {

	constructor: THREE.SubDOBJLoader,

	load: function ( url, onLoad, onProgress, onError ) {

		var scope = this;

		var loader = new THREE.XHRLoader( scope.manager );
		//loader.setCrossOrigin( this.crossOrigin );
        loader.setPath( this.path );
		loader.load( url, function ( text ) {

			onLoad( scope.parse( text ) );

		} );

	},

	parse: function ( text ) {

		var verts = [];
		var faces = [];

		function parseVertexIndex( value ) {

			var index = parseInt( value );

			return ( index >= 0 ? index - 1 : index + verts.length );

		}

		function parseUVIndex( value ) {

			var index = parseInt( value );

			return ( index >= 0 ? index - 1 : index + uvs.length );

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
                if(verts.length==0) continue;
                else{
                    info.innerHTML= "Warning: Mesh with many objects";   
                    break;   
                } 

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

