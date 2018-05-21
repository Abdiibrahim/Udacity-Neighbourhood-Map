/* Global Variables */
var map; // holds the map object
var infoWindow; // holds the info-windo object
var bounds; // holds the bounds of the created markers on the map 

/* Init Map Function */
function initMap() {
	
	// defines map location coorodinates
	var hamilton = {
		lat: 43.2557,
		lng: -79.8711
	};
	// creates the map centered on Hamilton, ON, Canada
	map = new google.maps.Map(document.getElementById('map'), {
		zoom : 13,
		center: hamilton,
		mapTypeControl: true,
		mapTypeControlOptions: {
			style: google.maps.MapTypeControlStyle.DROPDOWN_MENU
		  },
		fullscreenControl: false,
		mapTypeControlOptions: false
	});

	infoWindow = new google.maps.InfoWindow();
	bounds = new google.maps.LatLngBounds();

	ko.applyBindings(new ViewModel()); // initiates KnockoutJS for the ViewModel
};

function mapError() {
	alert('Error: GoogleMaps not working');
};

/* Location Marker defines where to place markers based on locations in data.js file */
var LocationMarker = function(data) {
	var self = this;

	// initiate descriptor variables for the location object
	this.title = data.title;
	this.location = data.location;
	this.street = '',
	this.city = '';

	this.display = ko.observable(true); // used to make data observable
	var icon = makeIcon(); // set icon

	// Set clientID and client secret for Foursquare API
	var clientID = '1KWE14CC4ESLC1SQWUTQY3NHVTROBEZVWNLOG0I4O0LNVJSN';
	var clientSecret = 'Z5ECVTHEYMD00WZ22CJKR5QUOHAVQN3XQS0KIPKNKSLRVVON';
	// use Foursquare API to return location data in JSON object request
	var apiURL = 'https://api.foursquare.com/v2/venues/search?ll=' + this.location.lat + ',' + this.location.lng + '&client_id='+ clientID + '&client_secret=' + clientSecret + '&v=20180516';

	// parse through JSON object response for street and city information
	$.getJSON(apiURL).done(function(data) {
		var results = data.response.venues[0];
		self.street = results.location.formattedAddress[0] ? results.location.formattedAddress[0] : 'N/A';
		self.city = results.location.formattedAddress[1] ? results.location.formattedAddress[1] : 'N/A';
	}).fail(function() {
		alert('Error: Foursquare not working');
	});

	// creates a marker at the position indicated by the location's coordinates
	this.marker = new google.maps.Marker({
		position: this.location,
		title: this.title,
		animation: google.maps.Animation.DROP,
		icon: icon
	});

	self.filterMarkers = ko.computed(function() {
		// if the new object is displayed
		if(self.display() === true) {
			self.marker.setMap(map); // place marker on the map
			bounds.extend(self.marker.position); // extend map bounds to include the marker
			map.fitBounds(bounds); // fit the map to the new bounds
		} else {
			self.marker.setMap(null); // set map to null, no map created
		}
	});

	// display info-window when a marker is clicked
	this.marker.addListener('click', function() {
		populateInfoWindow(this, self.street, self.city, infoWindow); // create info-window for this marker
		toggleBounce(this); // bounce animation
		map.panTo(this.getPosition()); // move map to this location
	});

	// shows the marker
	this.show = function(location) {
		google.maps.event.trigger(self.marker, 'click');
	};

	// bounces the marker
	this.bounce = function(place) {
		google.maps.event.trigger(self.marker, 'click'); // 
	};

};

/* View Model */
var ViewModel = function() {
	var self = this;

	this.searchTerm = ko.observable(''); // holds the current search term
	this.locationList = ko.observableArray([]); // holds the list of locations

	// add markers for each location and push it to the locations list
	locations.forEach(function(location) {
		self.locationList.push(new LocationMarker(location));
	});


	this.locationList = ko.computed(function() {
		var searchFilter = self.searchTerm().toLowerCase(); // filter the search term using lowercase
		if (searchFilter) {
			return ko.utils.arrayFilter(self.locationList(), function(location) {
				var str = location.title.toLowerCase();
				var res = str.includes(searchFilter); // result is a term that contains the search term
				location.display(res); // displays the result locations
				return res;
			});
		}
		self.locationList().forEach(function(location) {
			location.display(true);
		});
		return self.locationList();
	}, self);
};

/* Adds location details to the info-window */
function populateInfoWindow(marker, street, city, infowindow) {
	if (infowindow.marker != marker) {
		infowindow.setContent('');
		infowindow.marker = marker;

		// closes the info-window when close is clicked
		infowindow.addListener('closeclick', function() {
			infowindow.marker = null;
		});
		
		// creates a streetview object in the info-window
		var streetViewService = new google.maps.StreetViewService();
		var radius = 50;

		// formatting the content in the window
		var windowContent = '<h3>' + marker.title + '</h3>' + '<p>' + street + '<br>' + city + '</p>';

		// gets the sreet view if it exists. Adds panorama options
		var getStreetView = function (data, status) {
			// if the map street-view is found
			if (status == google.maps.StreetViewStatus.OK) {
				var nearStreetViewLocation = data.location.latLng; // gets a point close to the location in question
				var heading = google.maps.geometry.spherical.computeHeading(nearStreetViewLocation, marker.position); // compute headings for the panorama
				infowindow.setContent(windowContent + '<div id="pano"></div>'); // adds the street-view to the location info
				// define pano options
				var panoramaOptions = {
					position: nearStreetViewLocation,
					pov: {
						heading: heading,
						pitch: 0
					}
				};
				var panorama = new google.maps.StreetViewPanorama(document.getElementById('pano'), panoramaOptions); // 
			} else {
				// display a message if street view is unavailable
				infowindow.setContent(windowContent + '<div>Street-view not available</div>');
			}
		};

		streetViewService.getPanoramaByLocation(marker.position, radius, getStreetView); // gets the panorama
		infowindow.open(map, marker); // opens the info-window on the map
	}
};

// Sets the animation for the markers
function toggleBounce(marker) {
	if (marker.getAnimation() !== null) {
		marker.setAnimation(null);
	} else {
		marker.setAnimation(google.maps.Animation.BOUNCE);
		setTimeout(function() {
			marker.setAnimation(null);
		}, 1400);
	}
};

// Creates the marker images
function makeIcon() {
	var image = {
		url: 'http://chart.googleapis.com/chart?chst=d_map_spin&chld=1.15|0|D65555|40|_|%E2%80%A2',
		size: new google.maps.Size(21, 34),
		origin: new google.maps.Point(0, 0),
		anchor: new google.maps.Point(10, 34),
		scaledSize: new google.maps.Size(21, 34)
	};
	return image;
};
