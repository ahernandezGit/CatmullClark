var HEMESH_INVALID_IDX = -1;
function Hemesh() {
	this.vertexAdjacency = [];
	this.halfedgeAdjacency = [];
	this.faceAdjacency = [];
	this.positions = [];
}

Hemesh.prototype.printFace = function(f) {
	var h = this.faceHalfedge(f);
	var hs = h;
	var vertices = [];
	do {
		vertices.push(this.halfedgeVertex(h)+"("+h+")");
		h = this.halfedgeNext(h);
	} while(h !== hs);
	console.log(vertices.join("-"));
}


/***************
	Mesh modification
*/
Hemesh.prototype.addVertex = function(pos) {
	this.positions.push(pos);
	this.vertexAdjacency.push(HEMESH_INVALID_IDX);
	return this.vertexAdjacency.length-1;
}

Hemesh.prototype.moveVertexTo = function(v, pos) {
	this.positions[v] = pos;
}

Hemesh.prototype.createHalfedgeAdjacencyInfo = function() {
	return {
		prev: HEMESH_INVALID_IDX,
		next: HEMESH_INVALID_IDX,
		vertex: HEMESH_INVALID_IDX,
		face: HEMESH_INVALID_IDX
	};
}

Hemesh.prototype.addEdge = function() {
	this.halfedgeAdjacency.push(this.createHalfedgeAdjacencyInfo());
	this.halfedgeAdjacency.push(this.createHalfedgeAdjacencyInfo());
	return this.halfedgeAdjacency.length-2;
}

Hemesh.prototype.addFaces = function(faces, notNew) {
	var edges = {};
	var edgeMap = {};
	
	// attach halfedges to vertices
	for(var i=0; i < faces.length; ++i) {
		var face = faces[i];
		var nv = face.length;
		for(var j=0; j < nv; ++j) {
			var v1 = face[j];
			var v2 = face[(j+1)%nv];
			if(v1 > v2) {
				var v = v2;
				v2 = v1;
				v1 = v;
			}
			
			var k = v1+"-"+v2;
			if(edges[k] === undefined) {
				edges[k] = [v1, v2];
				
				//if(dbg) console.log("ADD:", v1, v2, this.findHalfedge(v1, v2, true));
				
				var hfound = HEMESH_INVALID_IDX;
				if(notNew) hfound = this.findHalfedge(v1, v2);
				if(this.halfedgeValid(hfound)) {
					edgeMap[k] = hfound;
				}
				else {
					var h1 = this.addEdge();
					var h2 = h1+1;
					this.setHalfedgeVertex(h1, v2);
					this.setHalfedgeVertex(h2, v1);
					
					if(!notNew) {
						this.setVertexHalfedge(v2, h1);
						this.setVertexHalfedge(v1, h2);
					}
					edgeMap[k] = h1;
				}
			}
		}
	}
	
	// link halfedges around faces
	for(var i=0; i < faces.length; ++i) {
		var face = faces[i];
		var nv = face.length;
		var halfedges = [];
		for(var j=0; j < nv; ++j) {
			var v1 = face[j];
			var v2 = face[(j+1)%nv];
			var didSwap = false;
			if(v1 > v2) {
				didSwap = true;
				var v = v2;
				v2 = v1;
				v1 = v;
			}
			
			var k = v1+"-"+v2;
			
			var h = edgeMap[k];
			if(didSwap) halfedges.push(this.halfedgeOpposite(h));
			else halfedges.push(h);
		}
		
		for(var j=0; j < nv; ++j) {
			var h1 = halfedges[j];
			var h2 = halfedges[(j+1)%nv];
			
			this.setHalfedgeNext(h1, h2);
			this.setHalfedgePrev(h2, h1);
		}
	}

	for(var i=0; i < faces.length; ++i) {
		this.addFace(faces[i]);
	}
}

Hemesh.prototype.addFace = function(vertices) {
	var halfedges = [];
	var halfedgesPrev = [];
	var halfedgesNext = [];
	var exists = [];
	var nv = vertices.length;
	for(var i=0; i < nv; ++i) {
		var v1 = vertices[i];
		var v2 = vertices[(i+1)%nv];
		
		var h = this.findHalfedge(v1, v2);
		var hExists = this.halfedgeValid(h);
		if(hExists){
			if(!this.halfedgeIsOnBoundary(h)){
				console.warn("attempting to add face not on boundary: "+vertices.join(" "));
                var edge=new THREE.Geometry();
                var materialBoundary = new THREE.LineBasicMaterial( { color: 0xB404AE, linewidth: 2 } );
                for(var i=0;i<vertices.length;i++){
                    edge.vertices.push(this.positions[vertices[i]]);
                }
                edge.vertices.push(this.positions[vertices[vertices.length-1]]);
                var lines = new THREE.Line(edge,materialBoundary);
                setup.scene.add(lines);
                console.log("halfedge ",h);
                //console.log("v1 ",v1);
                //console.log("v2 ",v2);  
                return HEMESH_INVALID_IDX;
                throw "muito ruim";
			}
			
			halfedgesPrev.push(this.halfedgePrev(h));
			halfedgesNext.push(this.halfedgeNext(h));
		}
		else {
			h = this.addEdge();
			
			halfedgesPrev.push(HEMESH_INVALID_IDX);
			halfedgesNext.push(HEMESH_INVALID_IDX);
		}
		
		halfedges.push(h);
		exists.push(hExists);
	}
	
	this.faceAdjacency.push(HEMESH_INVALID_IDX);
	var f = this.faceAdjacency.length-1;
	
	for(var i=0; i < nv; ++i) {
		var h = halfedges[i];
		this.setHalfedgeFace(h, f);
		
		var pidx = (i+nv-1)%nv;
		var nidx = (i+1)%nv;
		var p = halfedges[pidx];
		var n = halfedges[nidx];
		this.setHalfedgePrev(h, p);
		this.setHalfedgeNext(h, n);
		
		var v2 = vertices[nidx];
		this.setHalfedgeVertex(h, v2);
		this.setVertexHalfedge(v2, h);
		
		if(!exists[i]) {
			var ho = this.halfedgeOpposite(h);
			var v1 = vertices[i];
			this.setHalfedgeVertex(ho, v1);
			this.setVertexHalfedge(v1, ho);
			
			if(exists[nidx]) {
				var np = halfedgesPrev[nidx];
				this.setHalfedgePrev(ho, np);
				this.setHalfedgeNext(np, ho);
			}
			else {
				this.setHalfedgePrev(ho, this.halfedgeOpposite(n));
			}
			
			if(exists[pidx]) {
				var nn = halfedgesNext[pidx];
				this.setHalfedgeNext(ho, nn);
				this.setHalfedgePrev(nn, ho);
			}
			else {
				this.setHalfedgeNext(ho, this.halfedgeOpposite(p));
			}
		}
	}
	
	this.setFaceHalfedge(f, halfedges[0]);
	return f;
}

Hemesh.prototype.removeFace = function(f) {
	var h = this.faceHalfedge(f);
	var hs = h;
	do {
		this.setHalfedgeFace(h, HEMESH_INVALID_IDX);
		h = this.halfedgeNext(h);
	} while(h !== hs);
	this.setFaceHalfedge(f, HEMESH_INVALID_IDX);
}

/***************
	Face properties
*/

// Assumes triangle mesh
Hemesh.prototype.faceArea = function(f) {
	var h1 = this.faceHalfedge(f);
	var h2 = this.halfedgeNext(h1);
	var d1 = this.halfedgeDirection(h1);
	var d2 = this.halfedgeDirection(h2);
	var n = d1.cross(d2);
	return n.length()*0.5;
}


Hemesh.prototype.faceSize = function(f) {
	var h = this.faceHalfedge(f);
	var hs = h;
	var N = 0;
	do {
		++N;
		h = this.halfedgeNext(h);
	} while(h !== hs);
	return N;
}

Hemesh.prototype.faceVertices = function(f) {
	var h = this.faceHalfedge(f);
	var hs = h;
	var vertices = [];
	do {
		vertices.push(this.halfedgeVertex(h));
		h = this.halfedgeNext(h);
	} while(h !== hs);
	return vertices;
}

Hemesh.prototype.facePoints = function(f) {
	var h = this.faceHalfedge(f);
	var hs = h;
	var points = [];
	do {
		points.push(this.positions[this.halfedgeVertex(h)]);
		h = this.halfedgeNext(h);
	} while(h !== hs);
	return points;
}

Hemesh.prototype.faceCentroid = function(f) {
	var h = this.faceHalfedge(f);
	var hs = h;
	
	var centroid = new THREE.Vector3(0, 0, 0);
	var N = 0;
	do {
		var v = this.halfedgeVertex(h);
		var p = this.positions[v];
		centroid.add(p);
		++N;
		h = this.halfedgeNext(h);
	} while(h !== hs);
	return centroid.multiplyScalar(1/N);
}

Hemesh.prototype.faceValid = function(f) {
	return f !== HEMESH_INVALID_IDX;
}

Hemesh.prototype.faceHalfedge = function(f) {
	return this.faceAdjacency[f];
}

Hemesh.prototype.setFaceHalfedge = function(f, h) {
	this.faceAdjacency[f] = h
}


/***************
	Vertex properties
*/
Hemesh.prototype.vertexDualArea = function(v) {
	var A = 0;
	var h = this.vertexHalfedge(v);
	var hs = h;
	do {
		var f = this.halfedgeFace(h);
		A += this.faceArea(f);
		h = this.halfedgeSinkCCW(h);
	} while(h != hs);
	return A*0.333333333333333;
}

Hemesh.prototype.vertexPoint = function(v) {
	return this.positions[v];
}

Hemesh.prototype.vertexValid = function(v) {
	return v !== HEMESH_INVALID_IDX;
}

Hemesh.prototype.vertexHalfedge = function(v) {
	return this.vertexAdjacency[v];
}

Hemesh.prototype.setVertexHalfedge = function(v, h) {
	this.vertexAdjacency[v] = h
}


/***************
	Halfedge properties
*/

Hemesh.prototype.vertexValence= function(v) {
    var s=0;	
    var h=this.vertexHalfedge(v);
    var hs=h;
    var finish=false;
    //var geometryedge = new THREE.Geometry();
    //var geometryobject = new THREE.Object3D();
    //var material = new THREE.LineBasicMaterial( { color: 0x27B327, linewidth: 2 } );
    //if(this.halfedgeValid(this.halfedgeOpposite(h)){
       //console.log([this.positions[v],this.positions[this.halfedgeVertex(this.halfedgeOpposite(h))]]);    
       //geometryedge.vertices=[this.positions[v],this.positions[this.halfedgeVertex(this.halfedgeOpposite(h))]];
       //var line = new THREE.Line(geometryedge,material);
       //geometryobject.add(line);    
    //}
	do {
		h = this.halfedgeSinkCCW(h);
        if(h>-1){
               s++;
               //var geometryedge = new THREE.Geometry();
               //console.log([this.positions[v],this.positions[this.halfedgeVertex(this.halfedgeOpposite(h))]]);
               //geometryedge.vertices=[this.positions[v],this.positions[this.halfedgeVertex(this.halfedgeOpposite(h))]];
               //var line = new THREE.Line(geometryedge,material);
               //geometryobject.add(line);
        }
        else{break;}
        
	} while(h !== hs);
    if(h<0){//neighborhood is not cyclic  
        s=0;
        h=this.vertexHalfedge(v);
        //getting most left half edge
        do{
            hs=h;
            h = this.halfedgeSinkCCW(h);
        }while(h>-1);
        h=hs;
        /*var geometryedge = new THREE.Geometry();
        var geometryobject1 = new THREE.Object3D();
        if(this.halfedgeValid(this.halfedgeOpposite[h])){
            //console.log([this.positions[v],this.positions[this.halfedgeVertex(this.halfedgeOpposite(h))]]); 
            geometryedge.vertices=[this.positions[v],this.positions[this.halfedgeVertex(this.halfedgeOpposite(h))]];
            var line = new THREE.Line(geometryedge,material);
            geometryobject1.add(line);
        }*/
        do {
            h = this.halfedgeSinkCW(h);
            if(h>-1){
                    s++;
                    //var geometryedge = new THREE.Geometry();
                    //console.log([this.positions[v],this.positions[this.halfedgeVertex(this.halfedgeOpposite(h))]]);
                    //geometryedge.vertices=[this.positions[v],this.positions[this.halfedgeVertex(this.halfedgeOpposite(h))]];
                    //var line = new THREE.Line(geometryedge,material);
                    //geometryobject1.add(line);
            }
            else{break;}
	    }while(h !== hs);
        //setup.scene.add(geometryobject1);    
    }
    
    /*else{
        setup.scene.add(geometryobject);    
    }
    */
    return s;
}

Hemesh.prototype.halfedgeCotan = function(h) {
	var h2 = this.halfedgeNext(h);
	var h3 = this.halfedgeNext(h2);
	
	var u = this.halfedgeDirection(h3)
	var v = this.halfedgeDirection(this.halfedgeOpposite(h2));
	
	//return u.dot(v)/u.clone().cross(v).length();
    return u.dot(v)/u.clone().cross(v).length();
}

Hemesh.prototype.halfedgeDirection = function(h) {
	var v1 = this.halfedgeSource(h);
	var v2 = this.halfedgeSink(h);
	var p1 = this.positions[v1];
	var p2 = this.positions[v2];
	return p2.clone().sub(p1);
}

Hemesh.prototype.halfedgeMidpoint = function(h) {
	var v1 = this.halfedgeSource(h);
	var v2 = this.halfedgeSink(h);
	var p1 = this.positions[v1];
	var p2 = this.positions[v2];
	return p2.clone().add(p1).multiplyScalar(0.5);
}

Hemesh.prototype.halfedgeValid = function(h) {
	return h !== HEMESH_INVALID_IDX;
}

Hemesh.prototype.halfedgeIsOnBoundary = function(h) {
	return this.halfedgeFace(h) === HEMESH_INVALID_IDX;
}

Hemesh.prototype.halfedgeOpposite = function(h) {
	if((h&1) === 1) return h-1;
	else return h+1
}

Hemesh.prototype.halfedgeVertex = function(h) {
    if(h>-1){
	   return this.halfedgeAdjacency[h].vertex;
    }
    else{
       console.log("problem halfedge ",h);
    }
}

Hemesh.prototype.setHalfedgeVertex = function(h, v) {
	this.halfedgeAdjacency[h].vertex = v;
}

Hemesh.prototype.halfedgeFace = function(h) {
	return this.halfedgeAdjacency[h].face;
}

Hemesh.prototype.setHalfedgeFace = function(h, f) {
	this.halfedgeAdjacency[h].face = f;
}

Hemesh.prototype.halfedgeSource = function(h) {
	return this.halfedgeVertex(this.halfedgeOpposite(h));
}

Hemesh.prototype.halfedgeSink = function(h) {
	return this.halfedgeVertex(h);
}

Hemesh.prototype.halfedgeNext = function(h) {
	return this.halfedgeAdjacency[h].next;
}

Hemesh.prototype.setHalfedgeNext = function(h, next) {
	this.halfedgeAdjacency[h].next = next;
}

Hemesh.prototype.halfedgePrev = function(h) {
	return this.halfedgeAdjacency[h].prev;
}

Hemesh.prototype.setHalfedgePrev = function(h, prev) {
	this.halfedgeAdjacency[h].prev = prev;
}

Hemesh.prototype.halfedgeSourceCW = function(h) {
	return this.halfedgeNext(this.halfedgeOpposite(h));
}

Hemesh.prototype.halfedgeSourceCCW = function(h) {
	return this.halfedgeOpposite(this.halfedgePrev(h));
}

Hemesh.prototype.halfedgeSinkCW = function(h) {
	return this.halfedgeOpposite(this.halfedgeNext(h));
}

Hemesh.prototype.halfedgeSinkCCW = function(h) {
	return this.halfedgePrev(this.halfedgeOpposite(h));
}

Hemesh.prototype.findHalfedge= function(v1, v2, dbg) {
	var h1 = this.vertexHalfedge(v1);
	var h2 = this.vertexHalfedge(v2);
	
	if(this.halfedgeValid(h2) && this.halfedgeValid(h1)) {
		var hs = h2;
        var t=0;
		do {
			if(!this.halfedgeValid(h2)) return HEMESH_INVALID_IDX;

			if(this.halfedgeSource(h2) == v1) {
				return h2;
			}
			
			h2 = this.halfedgeSinkCCW(h2);
            t++;
		} while(h2 !== hs && t<10);
	}
	return HEMESH_INVALID_IDX;
}
Hemesh.prototype.vertexCirculator = function (f, he) {
	var start = he;
	//var vtx = this.halfedgeVertex(he);
	var max = 20; // A failsafe for corrupt hds
	while (true) {
		if (f(he) != undefined) break;
		he = this.halfedgeSinkCCW(he);
		if (he === start) break;
		if (max--== 0) throw "Corrupt hds in vertex circulation";
	}
}
Hemesh.prototype.vertexCirculatorCW = function (f, he) {
	var start = he;
	//var vtx = this.halfedgeVertex(he);
	var max = 20; // A failsafe for corrupt hds
	while (true) {
		if (f(he) != undefined) break;
		he = this.halfedgeSinkCW(he);
		if (he === start) break;
		if (max--== 0) throw "Corrupt hds in vertex circulation";
	}
}
Hemesh.prototype.vertexCirculatorPartial = function (f, he) {
	var start = he;
	//var vtx = this.halfedgeVertex(he);
	var max = 20; // A failsafe for corrupt hds
    var hs=-1;
    //var table=[he];
	while (true) {
		if (f(he) != undefined) break;
        hs=he;
		he = this.halfedgeSourceCW(he);
        //table.push(he);
		if (he === start) break;  
        if (he<0) break;
		if (max--== 0){
              console.log(hs);
              console.log(he);            
              throw "Corrupt hds in vertex circulation non negative";  
        } 
	}
    //console.log("non negative ", table);
    if(he<0){
        he=hs;
        //table=[he];
        max=20;
        while (true) {
            if (f(he) != undefined) break;
            he = this.halfedgeSourceCCW(he);
            //table.push(he);
            if (he<0 || he==hs) break;
            if (max--== 0){
              console.log(hs);
              console.log(he);    
              //console.log("negative ", table);
              throw "Corrupt hds in vertex circulation negative";  
            } 
	    }
        
    }
    
}
Hemesh.prototype.vertexCirculatorIJ= function (f,i,v,j) {
	var start = this.findHalfedge(i,v);
    start=this.halfedgeSinkCW(start);
	//var vtx = this.halfedgeVertex(he);
	var max = 20; // A failsafe for corrupt hds
	while (true) {
		if (f(v) != undefined) break;
        var vtx=this.halfedgeSourceCW(start);
		if (vtx === j) break;
        start = this.halfedgeSinkCW(start);
		if (max--== 0) throw "Corrupt hds in vertex circulation";
	}
}


/***************
	Mesh-level operations
*/
Hemesh.prototype.triangulate = function() {
	var newFaces = [];
	for(var f=0; f < this.faceAdjacency.length; ++f) {
		var h = this.faceHalfedge(f);
		if(h !== HEMESH_INVALID_IDX) {
			var vertices = this.faceVertices(f);
			if(vertices.length > 3) {
				this.removeFace(f);
				for(var i=2; i < vertices.length; ++i) {
					newFaces.push([
						vertices[0], vertices[i-1], vertices[i]
					]);
				}
			}
		}
	}

	this.addFaces(newFaces, true);
}

Hemesh.prototype.normalize = function() {
	var min = new THREE.Vector3(1000000, 1000000, 1000000);
	var max = new THREE.Vector3(-1000000, -1000000, -1000000);
	
	for(var v=0; v < this.vertexAdjacency.length; ++v) {
		if(this.halfedgeValid(this.vertexHalfedge(v))) {
			var p = this.vertexPoint(v);
			min.min(p);
			max.max(p);
		}
	}
	var range = max.clone().sub(min);
	var scale = new THREE.Vector3(2/range.x, 2/range.y, 2/range.z);
	var one = new THREE.Vector3(1, 1, 1);
	
	for(var v=0; v < this.vertexAdjacency.length; ++v) {
		if(this.halfedgeValid(this.vertexHalfedge(v))) {
			var p = this.vertexPoint(v);
			p.sub(min).multiply(scale).sub(one);
			this.moveVertexTo(v, p);
		}
	}
	
	for(var v=0; v < this.vertexAdjacency.length; ++v) {
		if(this.halfedgeValid(this.vertexHalfedge(v))) {
			var p = this.vertexPoint(v);
			//console.log(v, p.x, p.y, p.z);
		}
	}
}

/***************
	Import/export
*/
Hemesh.prototype.fromOBJ = function(text) {
	var lines = text.match(/[^\r\n]+/g);
	var vertices = [];
	var faces = [];
	for(var i=0; i < lines.length; ++i) {
		var line = lines[i];
		if(line[0] === "v") {
			var coords = line.match(/[e\d.-]+/g);
			for(var j=0; j < coords.length; ++j) {
				coords[j] = parseFloat(coords[j]);
			}
			vertices.push(new THREE.Vector3(coords[0], coords[1], coords[2]));
		}
		else if(line[0] === "f") {
			var indices = line.match(/[\d.]+/g);
			for(var j=0; j < indices.length; ++j) {
				indices[j] = parseInt(indices[j])-1;
			}
			faces.push(indices);
		}
	}
	for(var i=0; i < vertices.length; ++i) {
		this.addVertex(vertices[i]);
	}
	this.addFaces(faces);
}
Hemesh.prototype.fromFaceVertexArray = function(faces,vertices) {
	for(var i=0; i < vertices.length; ++i) {
		this.addVertex(vertices[i]);
	}
	this.addFaces(faces);
}

Hemesh.prototype.toOBJ = function() {
	var vertices = [];
	var vertexMap = {};
	var vidx = 1;
	for(var v=0; v < this.vertexAdjacency.length; ++v) {
		var h = this.vertexHalfedge(v);
		if(h !== HEMESH_INVALID_IDX) {
			var pos = this.positions[v];
			vertices.push(
				"v "+pos.x+" "+pos.y+" "+pos.z
			);
			vertexMap[v] = vidx;
			++vidx;
		}
	}
	
	var faces = [];
	for(var f=0; f < this.faceAdjacency.length; ++f) {
		var h = this.faceHalfedge(f);
		if(h !== HEMESH_INVALID_IDX) {
			var faceVertices = this.faceVertices(f);
			for(var i=0; i < faceVertices.length; ++i) {
				faceVertices[i] = vertexMap[ faceVertices[i] ];
			}
			
			faces.push(
				"f "+faceVertices.join(" ")
			);
		}
	}
	
	return [
		vertices.join("\n"),
		"# "+vertices.length+" vertices",
		"",
		faces.join("\n"),
		"# "+faces.length+" faces",
	].join("\n");
}

Hemesh.prototype.toGeometry = function() {
	var geometry = new THREE.Geometry();
	geometry.vertices = this.positions;
	for(var f=0; f < this.faceAdjacency.length; ++f) {
		var h = this.faceHalfedge(f);
		if(this.halfedgeValid(h)) {
			var hs = h;
			var ff = [];
			do {
				var v = this.halfedgeVertex(h);
				ff.push(v);
				h = this.halfedgeNext(h);
			} while(h != hs);
			//var normals=[this.computeAverageNormal(ff[0]),this.computeAverageNormal(ff[1]),this.computeAverageNormal(ff[2])];
			geometry.faces.push(new THREE.Face3(ff[0], ff[1], ff[2]));
		}
	}
	return geometry;
}
Hemesh.prototype.computeAverageNormal=function(v){
    var h=this.vertexHalfedge(v);
    var normal=new THREE.Vector3(0,0,0);
    var t=0;
    var hemesh=this;
    this.vertexCirculator(function(he){
        //normal of one face
        var source=hemesh.halfedgeSource(he)
        var she=hemesh.halfedgeSinkCCW(he);
        var sv=hemesh.halfedgeSource(she);
        var a=hemesh.positions[source].clone().sub(hemesh.positions[v]);
        var b=hemesh.positions[sv].clone().sub(hemesh.positions[v]);
        var n=new THREE.Vector3();
        n.crossVectors( a, b );
        n.normalize();
        normal.add(n);
        t++;
    },h);
    normal.divideScalar(t);
    normal.normalize();
    return normal;
}
Hemesh.prototype.toWireframeGeometry = function() {
	var geometry = new THREE.Geometry();
	for(var h=0; h < this.halfedgeAdjacency.length; h += 2) {
		if(this.vertexValid(this.halfedgeVertex(h))) {
			var v1 = this.halfedgeSource(h);
			var v2 = this.halfedgeSink(h);
			geometry.vertices.push(this.vertexPoint(v1));
			geometry.vertices.push(this.vertexPoint(v2));	
		}
	}
	return geometry;
}

Hemesh.prototype.fromGeometry = function(geo) {
	for(var i=0; i < geo.vertices.length; ++i) {
		this.addVertex(geo.vertices[i]);
	}
	var hfaces = [];
	for(var i=0; i < geo.faces.length; ++i) {
		var f = geo.faces[i];
		hfaces.push([f.a, f.b, f.c]);
	}
	this.addFaces(hfaces);
}