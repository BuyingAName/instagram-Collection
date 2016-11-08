var app = angular.module('collections', ['daterangepicker', 'infinite-scroll']);

app.controller('mainController', ($scope, $http) => {
	$scope.date = {
		startDate: null,
		endDate: null
	};
	$scope.posts = [];
	$scope.data = [];
	$scope.maxDate = moment();	

	$scope.create = function(tag, daterange) {
		var url = '/createCollection';
		var data = {
			tag: tag,
			startDate: daterange.startDate.unix(),
			endDate: daterange.endDate.unix(),
		};
		$http.post(url,data)
		.then(function(response) {
			console.log(response);
			//$scope.posts = response.data;
		}, function(error){
			console.log(error);
		});
	};

	$scope.view = function(tag, daterange) {
		console.log(tag + ',' + daterange.startDate.unix() + ',' + daterange.endDate.unix());
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
			console.log(response);
			$scope.data = response.data;
		}, function(error){
			console.log(error);
		});
	};
	
	//Loads 6 more elements into the infinite scroll
	$scope.loadMore = function() {
		var postsLength = $scope.posts.length;
		
		if(postsLength + 6 > $scope.data.length ){
			$scope.posts.push.apply($scope.posts , $scope.data.slice(postsLength));
		} else {
			$scope.posts.push.apply($scope.posts, $scope.data.slice(postsLength, postsLength +6));
		}
		console.log('loaded more elements');
	};
});

//validate Hashtags
app.directive('hashtag', function() {
	return {
		require: 'ngModel',
		link: function(scope, elm, attrs, ctrl) {
			ctrl.$validators.hashtag = function(modelValue, viewValue) {
				if(ctrl.$isEmpty(modelValue)) return true;
				if(/[$-/:-?{-~!"^`\[\]\s]/.test(modelValue)) return false;
				return true;
			};
		}
	}
});

app.filter('trusted', ['$sce', function ($sce) {
    return function(url) {
        return $sce.trustAsResourceUrl(url);
    };
}]);
