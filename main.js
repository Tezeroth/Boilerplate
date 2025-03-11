/* jshint esversion: 9 */
/* global THREE, AFRAME */

/**
 * This component hides the entity when AR hit testing starts and shows it again when VR mode is exited.
 * Useful for indicators or placeholders that you only want visible before the AR scene is anchored.
 */
AFRAME.registerComponent("hide-on-hit-test-start", {
  init: function() {
    var self = this;
    // Listen for the "ar-hit-test-start" event fired by the scene when AR hit testing begins.
    this.el.sceneEl.addEventListener("ar-hit-test-start", function() {
      // When AR hit test starts, hide this element.
      self.el.object3D.visible = false;
    });
    // When exiting VR (or AR, since AR is a subset of VR modes), show the element again.
    this.el.sceneEl.addEventListener("exit-vr", function() {
      self.el.object3D.visible = true;
    });
  }
});

/**
 * This component resets the entity's position and rotation to the origin (0,0,0) when AR mode starts.
 * It listens to the scene's "enter-vr" event and checks if we are in AR mode.
 */
AFRAME.registerComponent("origin-on-ar-start", {
  init: function() {
    var self = this.el;

    this.el.sceneEl.addEventListener("enter-vr", function() {
      // "ar-mode" state is set by A-Frame when AR is activated.
      if (this.is("ar-mode")) {
        // Reset the entity's position and rotation so it aligns with the real-world AR starting point.
        self.setAttribute('position', {x:0,y:0,z:0});
        self.setAttribute('rotation', {x:0,y:0,z:0});
      }
    });
  }
});


/**
 * This component updates the current entity's position and rotation (quaternion) to match another element or the XR camera.
 * Useful to keep objects aligned with a specific reference, like the user's head (camera) or another object in the scene.
 */
AFRAME.registerComponent("match-position-by-id", {
  schema: {
    default: '' // The ID of the element to match position from, or special 'xr-camera' keyword.
  },
  tick() {
    let obj;

    // Special case: if the data is 'xr-camera', try to get the actual XR camera pose.
    if (this.data === 'xr-camera') {
      const xrCamera = this.el.sceneEl.renderer.xr.getCameraPose();
      if (xrCamera) {
        // If we have an XR camera pose, copy its position and orientation directly.
        this.el.object3D.position.copy(xrCamera.transform.position);
        this.el.object3D.quaternion.copy(xrCamera.transform.orientation);
        return;
      }
      // If no XR camera pose available, fallback to the scene's camera.
      obj = this.el.sceneEl.camera;
    } else {
      // For any other ID, grab the object3D of that element.
      obj = document.getElementById(this.data).object3D;
    }

    // If we found the object, copy its position and orientation.
    if (obj) {
      this.el.object3D.position.copy(obj.position);
      this.el.object3D.quaternion.copy(obj.quaternion);
    }
  }
});

/**
 * This component makes the entity follow the camera's position in the scene.
 * It uses camera's world position and transforms it into the parent's local space,
 * effectively keeping the entity at the camera's position relative to its parent.
 */
AFRAME.registerComponent("xr-follow", {
  schema: {},
  init() {
    // No initialization logic needed right now.
  },
  tick() {
    const scene = this.el.sceneEl;
    const camera = scene.camera;
    const object3D = this.el.object3D;

    // Get camera's world position
    camera.getWorldPosition(object3D.position);

    // Convert that position into the local coordinate system of the parent to maintain relative positioning.
    object3D.parent.worldToLocal(object3D.position);
  }
});

/**
 * This component triggers an exit from VR/AR mode when a specified event occurs on the entity.
 * By default, the event is "click", but you can specify another event in the schema.
 */
AFRAME.registerComponent("exit-on", {
  schema: {
    default: 'click' // The event that will cause VR exit
  },
  update(oldEvent) {
    const newEvent = this.data;
    // Remove old event listener (if changed)
    this.el.removeEventListener(oldEvent, this.exitVR);
    // Add new event listener
    this.el.addEventListener(newEvent, this.exitVR);
  },
  exitVR() {
    // When the event fires, exit VR mode.
    this.sceneEl.exitVR();
  }
});

/**
 * This component sets a physx-body attribute on the entity once its model has loaded.
 * Used to ensure physics is applied after the model is ready.
 */
AFRAME.registerComponent("physx-body-from-model", {
  schema: {
    type: 'string',
    default: ''
  },
  init () {
    const details = this.data;
    // On load event callback
    /**
 * This component sets a physx-body attribute on the entity once its model has loaded.
 * Used to ensure physics is applied after the model is ready.
 */
AFRAME.registerComponent("physx-body-from-model", {
  schema: {
    type: 'string',
    default: ''
  },
  init () {
    const details = this.data;
    // On load event callback
    this.onLoad = function () {
      // Set the physx-body attribute using the given details string.
      this.setAttribute('physx-body', details);
      
      // Set the attribute a second time with additional props after a short delay
      // This fixes an issue where physics bodies sometimes don't initialize correctly
      setTimeout(() => {
        this.setAttribute('physx-body', details);

      }, 100);
    };
    // Listen for when the underlying 3D object is set on the element.
    this.el.addEventListener('object3dset', this.onLoad);
  },
  remove () {
    // Cleanup the event listener if component is removed early.
    this.el.removeEventListener('object3dset', this.onLoad);
  }
});
  },
  remove () {
    // Cleanup the event listener if component is removed early.
    this.el.removeEventListener('object3dset', this.onLoad);
  }
});

/**
 * This component toggles physics states when items are picked up and put down.
 * On 'pickup', it adds a 'grabbed' state.
 * On 'putdown', it removes that state and applies the captured linear and angular velocities
 * from the user's hand controllers (if available) to make the object continue with realistic motion.
 */
/* Turn physics off and on when object is grabbed then released */
AFRAME.registerComponent("toggle-physics", {
  events: {
    pickup: function() {
      this.el.addState('grabbed');
    },
    putdown: function(e) {
      this.el.removeState('grabbed');
      if (e.detail.frame && e.detail.inputSource) {
        const referenceSpace = this.el.sceneEl.renderer.xr.getReferenceSpace();
        const pose = e.detail.frame.getPose(e.detail.inputSource.gripSpace, referenceSpace);
        if (pose && pose.angularVelocity) {
          this.el.components['physx-body'].rigidBody.setAngularVelocity(pose.angularVelocity);
        }
        if (pose && pose.linearVelocity) {
          this.el.components['physx-body'].rigidBody.setLinearVelocity(pose.linearVelocity);
        }
      }
    }
  }
});

/**
 * This component simulates climbing a ladder in VR/AR by manipulating the cameraRig position based on the user's hand positions.
 * When a hand "grabs" a ladder rung, movement constraints are adjusted so the user can "pull" themselves up.
 * Releasing the ladder returns movement to normal navigation.
 */



// Once the DOM content is fully loaded, run this setup function.
window.addEventListener("DOMContentLoaded", function() {
  const sceneEl = document.querySelector("a-scene");
  const message = document.getElementById("dom-overlay-message");
  const arContainerEl = document.getElementById("my-ar-objects");
  const cameraRig = document.getElementById("cameraRig");
  const building = document.getElementById("building");

  // Once the building's 3D object is set, update reflections in the reflection component if present.
  building.addEventListener('object3dset', function () {
    if (this.components && this.components.reflection) this.components.reflection.needsVREnvironmentUpdate = true;
  }, {once: true});
  
  // Set up pose and gamepad event listeners for elements with class 'pose-label'
  // These will update a text element with the current pose or gamepad event name.
  const labels = Array.from(document.querySelectorAll('.pose-label'));
  for (const el of labels) {
    el.parentNode.addEventListener('pose', function (event) {
      el.setAttribute('text', 'value', event.detail.pose);
    });
    el.parentNode.addEventListener('gamepad', function (event) {
      el.setAttribute('text', 'value', event.detail.event);
    });
  }
  
  // Watergun logic block:
  // The watergun can be grabbed from the body or the slider part.
  // If grabbed from the body: adjusts classes and constraints accordingly.
  // If grabbed from the slider: sets a linear constraint target so the slider can move.
  watergun: {
    const watergun = document.getElementById("watergun");
    const watergunSlider = watergun.firstElementChild;

    watergun.addEventListener('grabbed', function (e) {
      const by = e.detail.by;
      if (e.target === watergun) {
        // If the main watergun body was grabbed:
        watergun.className = '';
        // Determine which hand grabbed it and assign the slider's magnet class to opposite hand type.
        if (by.dataset.right) watergunSlider.className = 'magnet-left';
        if (by.dataset.left) watergunSlider.className = 'magnet-right';
      }
      if (e.target === watergunSlider) {
        // If slider is grabbed directly, set linear constraint to the grabbing hand's no-magnet element.
        watergun.setAttribute('linear-constraint', 'target', '#' + e.detail.byNoMagnet.id);
      }
    });

    watergun.addEventListener('released', function (e) {
      const by = e.detail.by;
      // On release, remove the linear constraint target.
      watergun.setAttribute('linear-constraint', 'target', '');
      if (e.target === watergun) {
        // Reset classes when watergun body is released.
        watergun.className = 'magnet-right magnet-left';
        watergunSlider.className = '';
      }
    });
  }

  // If the user interacts with the DOM overlay (like pressing a button),
  // we prevent any WebXR select events that might conflict with 3D selections.
  message.addEventListener("beforexrselect", e => {
    e.preventDefault();
  });

  // When entering VR mode, if we are entering AR mode specifically, show messages guiding the user through AR interactions.
  sceneEl.addEventListener("enter-vr", function() {
    if (this.is("ar-mode")) {
      // Clear message initially
      message.textContent = "";

      // Once AR hit testing starts, show scanning message.
      this.addEventListener(
        "ar-hit-test-start",
        function() {
          message.innerHTML = `Scanning environment, finding surface.`;
        },
        { once: true }
      );

      // Once a suitable surface is found:
      this.addEventListener(
        "ar-hit-test-achieved",
        function() {
          message.innerHTML = `Select the location to place<br />By tapping on the screen or selecting with your controller.`;
        },
        { once: true }
      );

      // Once the user selects a surface and places an object:
      this.addEventListener(
        "ar-hit-test-select",
        function() {
          message.textContent = "Well done!";
        },
        { once: true }
      );
    }
  });

  // When exiting VR/AR, show a message.
  sceneEl.addEventListener("exit-vr", function() {
    message.textContent = "Exited Immersive Mode";
  });
});

/**
 * This component replaces materials of objects whose material names match certain filters (like "Window")
 * with a custom translucent, reflective material for a more visually appealing window effect.
 */
AFRAME.registerComponent('window-replace', {
  schema: {
    default: '' // Comma-separated filters for material names to replace
  },
  init() {
    // When the object3d is set, we can iterate through the mesh and replace materials if needed.
    this.el.addEventListener('object3dset', this.update.bind(this));
    this.materials = new Map();
  },
  update() {
    // Split the filters by comma and trim spaces
    const filters = this.data.trim().split(',');

    // Traverse the object's 3D hierarchy.
    this.el.object3D.traverse(function (o) {
      if (o.material) {
        // Check if the object's material name contains any of the filtered keywords
        if (filters.some(filter => o.material.name.includes(filter))) {
          // Set renderOrder to ensure correct rendering order for transparency.
          o.renderOrder = 1;
          const m = o.material;
          const sceneEl = this.el.sceneEl;
          // If we have replaced this material before, reuse it. Otherwise, create a new one.
          o.material = this.materials.has(m) ?
            this.materials.get(m) :
            new THREE.MeshPhongMaterial({
              name: 'window_' + m.name,
              lightMap: m.lightmap || null,
              lightMapIntensity: m.lightMapIntensity,
              shininess: 90,
              color: '#ffffff',
              emissive: '#999999', // Give it a subtle glow
              emissiveMap: m.map,  // Use original texture as emissive map
              transparent: true,
              depthWrite: false,
              map: m.map,
              transparent: true,
              side: THREE.DoubleSide,
              get envMap() {return sceneEl.object3D.environment}, // Dynamically fetch environment map for reflections
              combine: THREE.MixOperation,
              reflectivity: 0.6, // Moderately reflective
              blending: THREE.CustomBlending,
              blendEquation: THREE.MaxEquation,
              toneMapped: m.toneMapped
            });
          
          window.mat = o.material; // For debugging: assign to global window object
          // Cache the created material so we don't recreate it multiple times.
          this.materials.set(m, o.material);
        }
      }
    }.bind(this));
  }
});
