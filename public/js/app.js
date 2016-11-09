var app = angular.module('collections', ['daterangepicker', 'infinite-scroll']);

app.controller('mainController', ($scope, $http) => {
	
	$scope.date = {
		startDate: null,
		endDate: null
	};
	$scope.btnClicked = false;
	$scope.posts = [];
	$scope.data = [];
	$scope.maxDate = moment();

	//Call CreateCollection API when the Create button is clicked
	$scope.create = function(tag, daterange) {
		
		$scope.btnClicked = true;
		$scope.posts = [];
		$scope.data = [];
		
		var url = '/createCollection';
		var data = {
			tag: tag,
			startDate: daterange.startDate.unix(),
			endDate: daterange.endDate.unix(),
		};
		
		$http.post(url,data)
		.then(function(response) {
			$scope.message = "Successfully created the collection, click the View button to see the posts";
		}, function(error){
			$scope.message = "Error creating collection, please try again or use a different hastag or date range";
			console.log(error);
		});
	};

	//Call getCollection API when the View button is clicked
	$scope.view = function(tag, daterange) {
		
		$scope.btnClicked = true;
		$scope.posts = [];
		$scope.data = [];
		
		var config = {
			method: 'GET',
			url: '/getCollection',
			params: {
				tag: tag,
				startDate: daterange.startDate.unix(),
				endDate: daterange.endDate.unix(),
			}
		};
		$http(config)
		.then(function(response) {
			$scope.data = response.data;
			if(response.data.length == 0) {
				$scope.message = 'No Results, create a new collection or change the hashtag or date range.';
			} else {
				$scope.message = response.data.length == 1 ? 'This Collection contains 1 post' : 'This Collection contains ' + response.data.length + ' posts';
			}
		}, function(error){
			$scope.message = "Error collecting posts, please try again or use a different hastag or date range";
			console.log(error);
		});
	};
	
	//Loads up to 6 more posts at the bottom of the page for infinite scrolling
	$scope.loadMore = function() {
		var postsLength = $scope.posts.length;
		
		if(postsLength + 6 > $scope.data.length ){
			$scope.posts.push.apply($scope.posts , $scope.data.slice(postsLength));
		} else {
			$scope.posts.push.apply($scope.posts, $scope.data.slice(postsLength, postsLength +6));
		}
	};
});

//validate Hashtags
app.directive('hashtag', function() {
	return {
		require: 'ngModel',
		link: function(scope, elm, attrs, ctrl) {
			ctrl.$validators.hashtag = function(modelValue, viewValue) {
				if(ctrl.$isEmpty(modelValue)){
					return true;
				}
				if(/[$-/:-?{-~!"^`\[\]\s]/.test(modelValue)) {
					return false;
				} 
				return true;
			};
		}
	}
});

//makes angular trust and load .mp4 urls in video tag
app.filter('trusted', ['$sce', function ($sce) {
    return function(url) {
        return $sce.trustAsResourceUrl(url);
    };
}]);
