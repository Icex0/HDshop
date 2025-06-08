// Vulnerable: Using AngularJS 1.8.2 which has known security vulnerabilities
angular.module('vulnerableApp', [])
    .controller('LoginController', function($scope, $http, $window) {
        $scope.credentials = {
            username: '',
            password: ''
        };

        // Vulnerable: No CSRF protection
        // Vulnerable: No input sanitization
        // Vulnerable: No XSS protection
        $scope.login = function() {
            $http.post('http://localhost:3000/api/login', $scope.credentials)
                .then(function(response) {
                    $scope.success = response.data.success;
                    $scope.message = response.data.message;
                    
                    if (response.data.success) {
                        $window.location.href = '/shop.html';
                    }
                })
                .catch(function(error) {
                    // Vulnerable: Exposing error details to user
                    $scope.success = false;
                    $scope.message = 'Error: ' + error.data.error;
                });
        };
    })
    .controller('RegisterController', function($scope, $http, $window) {
        $scope.user = {
            username: '',
            email: '',
            password: ''
        };

        $scope.register = function() {
            $http.post('http://localhost:3000/api/register', $scope.user)
                .then(function(response) {
                    $scope.success = response.data.success;
                    $scope.message = response.data.message;
                    
                    if (response.data.success) {
                        // Redirect to login page after successful registration
                        $window.location.href = '/';
                    }
                })
                .catch(function(error) {
                    $scope.success = false;
                    $scope.message = 'Error: ' + error.data.error;
                });
        };
    })
    .controller('ShopController', function($scope, $http, $window, $sce) {
        // Check session
        $http.get('http://localhost:3000/api/session')
            .then(function(response) {
                if (response.data.success) {
                    $scope.user = response.data.user;
                    // Vulnerable: Trusting user input as HTML
                    $scope.trustedUsername = $sce.trustAsHtml(response.data.user.username);
                } else {
                    $window.location.href = '/';
                }
            })
            .catch(function() {
                $window.location.href = '/';
            });

        // Vulnerable: Client-side data storage
        $scope.cart = [];
        $scope.showCart = false;
        
        // Vulnerable: Hardcoded products with cat images
        $scope.products = [
            {
                id: 1,
                name: 'Sleepy Cat',
                description: 'A peaceful sleeping cat that will bring tranquility to your home.',
                price: 99.99,
                image: '/assets/images/cat1.png'
            },
            {
                id: 2,
                name: 'Playful Kitten',
                description: 'An energetic kitten ready to play and bring joy to your life.',
                price: 149.99,
                image: '/assets/images/cat2.jpg'
            },
            {
                id: 3,
                name: 'Majestic Cat',
                description: 'A regal cat with an elegant pose, perfect for cat enthusiasts.',
                price: 199.99,
                image: '/assets/images/cat3.jpg'
            },
            {
                id: 4,
                name: 'Curious Cat',
                description: 'A curious cat exploring its surroundings, full of personality.',
                price: 129.99,
                image: '/assets/images/cat4.png'
            },
            {
                id: 5,
                name: 'Cozy Cat',
                description: 'A comfortable cat enjoying its favorite spot, bringing warmth to your home.',
                price: 179.99,
                image: '/assets/images/cat5.jpg'
            },
            {
                id: 6,
                name: 'Adventure Cat',
                description: 'An adventurous cat ready for new experiences and discoveries.',
                price: 159.99,
                image: '/assets/images/cat6.jpg'
            }
        ];

        // Vulnerable: Client-side price manipulation
        $scope.addToCart = function(product) {
            $scope.cart.push(product);
            $scope.showCart = true;
        };

        // Vulnerable: Client-side cart manipulation
        $scope.removeFromCart = function(index) {
            $scope.cart.splice(index, 1);
        };

        // Vulnerable: Client-side total calculation
        $scope.getTotal = function() {
            return $scope.cart.reduce((total, item) => total + item.price, 0);
        };

        // Toggle cart dropdown
        $scope.toggleCart = function() {
            $scope.showCart = !$scope.showCart;
        };

        // Close cart when clicking outside
        angular.element(document).bind('click', function(event) {
            if (!angular.element(event.target).closest('.cart-icon').length) {
                $scope.$apply(function() {
                    $scope.showCart = false;
                });
            }
        });

        // Vulnerable: No server-side validation
        $scope.checkout = function() {
            // Store cart in sessionStorage for checkout page
            sessionStorage.setItem('cart', JSON.stringify($scope.cart));
            $window.location.href = '/checkout.html';
        };

        $scope.goToCheckout = function() {
            $scope.checkout();
        };

        // Vulnerable: No proper session termination
        $scope.logout = function() {
            $http.post('/api/logout')
                .then(function() {
                    $window.location.href = '/';
                });
        };
    })
    .controller('CheckoutController', function($scope, $http, $window, $sce) {
        // Check session
        $http.get('http://localhost:3000/api/session')
            .then(function(response) {
                if (response.data.success) {
                    $scope.user = response.data.user;
                    // Vulnerable: Trusting user input as HTML
                    $scope.trustedUsername = $sce.trustAsHtml(response.data.user.username);
                } else {
                    $window.location.href = '/';
                }
            })
            .catch(function() {
                $window.location.href = '/';
            });

        // Vulnerable: Client-side data storage
        $scope.cart = JSON.parse(sessionStorage.getItem('cart') || '[]');
        $scope.processing = false;
        $scope.message = '';
        $scope.success = false;

        // Vulnerable: Client-side total calculation
        $scope.getTotal = function() {
            return $scope.cart.reduce((total, item) => total + item.price, 0);
        };

        // Vulnerable: Client-side cart manipulation
        $scope.removeFromCart = function(index) {
            $scope.cart.splice(index, 1);
            sessionStorage.setItem('cart', JSON.stringify($scope.cart));
        };

        // Vulnerable: No server-side validation
        $scope.completeCheckout = function() {
            $scope.processing = true;
            $scope.message = '';
            $scope.success = false;

            // Vulnerable: Client-side price calculation
            const purchaseData = {
                items: $scope.cart,
                total: $scope.getTotal()
            };

            $http.post('http://localhost:3000/api/purchase', purchaseData)
                .then(function(response) {
                    if (response.data.success) {
                        $scope.success = true;
                        $scope.message = 'Purchase completed successfully! Order ID: ' + response.data.orderId;
                        sessionStorage.removeItem('cart');
                        $scope.cart = [];
                    } else {
                        $scope.success = false;
                        $scope.message = 'Error: ' + response.data.message;
                    }
                })
                .catch(function(error) {
                    $scope.success = false;
                    $scope.message = 'Error: ' + (error.data?.error || 'Failed to complete purchase');
                })
                .finally(function() {
                    $scope.processing = false;
                });
        };

        $scope.goToShop = function() {
            $window.location.href = '/shop.html';
        };

        // Vulnerable: No proper session termination
        $scope.logout = function() {
            $http.post('/api/logout')
                .then(function() {
                    $window.location.href = '/';
                });
        };
    })
    .controller('ProfileController', function($scope, $http, $window, $timeout) {
        // Check session and get user ID
        $http.get('/api/session')
            .then(function(response) {
                if (response.data.success) {
                    const userId = response.data.user.userId;
                    
                    // Fetch user data
                    $http.get('/api/user/' + userId)
                        .then(function(response) {
                            $scope.user = response.data.user;
                        })
                        .catch(function(error) {
                            console.error('Error fetching user data:', error);
                            $scope.showNotification('Error loading profile', false);
                        });

                    // Fetch order history
                    $http.get('/api/user/' + userId + '/orders')
                        .then(function(response) {
                            $scope.orders = response.data.orders;
                        })
                        .catch(function(error) {
                            console.error('Error fetching orders:', error);
                            $scope.showNotification('Error loading order history', false);
                        });
                } else {
                    $window.location.href = '/';
                }
            })
            .catch(function() {
                $window.location.href = '/';
            });

        $scope.showNotification = function(message, isSuccess) {
            $scope.message = message;
            $scope.success = isSuccess;
            $timeout(function() {
                $scope.message = '';
            }, 3000);
        };

        $scope.updateProfile = function() {
            const data = {
                username: $scope.user.username,
                email: $scope.user.email
            };

            if ($scope.currentPassword && $scope.newPassword) {
                data.currentPassword = $scope.currentPassword;
                data.newPassword = $scope.newPassword;
            }

            $http.post('/api/profile/update', data)
                .then(function(response) {
                    if (response.data.success) {
                        $scope.showNotification('Profile updated successfully', true);
                        $scope.currentPassword = '';
                        $scope.newPassword = '';
                    } else {
                        $scope.showNotification(response.data.message || 'Error updating profile', false);
                    }
                })
                .catch(function(error) {
                    $scope.showNotification(error.data?.message || 'Error updating profile', false);
                });
        };

        $scope.logout = function() {
            $http.post('/api/logout')
                .then(function() {
                    $window.location.href = '/';
                })
                .catch(function(error) {
                    console.error('Error logging out:', error);
                });
        };

        $scope.uploadImage = function(input) {
            const file = input.files[0];
            if (!file) return;

            // Client-side file type validation
            const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
            if (!allowedTypes.includes(file.type)) {
                $scope.$apply(function() {
                    $scope.message = 'Only PNG and JPG files are allowed';
                    $scope.success = false;
                });
                input.value = ''; // Clear the file input
                $timeout(function() {
                    $scope.message = '';
                }, 3000);
                return;
            }

            const formData = new FormData();
            formData.append('profileImage', file);

            $http.post('/api/user/' + $scope.user.id + '/image', formData, {
                transformRequest: angular.identity,
                headers: {
                    'Content-Type': undefined
                }
            })
            .then(function(response) {
                if (response.data.success) {
                    $timeout(function() {
                        // Add a unique cache-busting query string
                        $scope.user.profile_image = response.data.imagePath + '?t=' + Date.now() + Math.random();
                        $scope.message = 'Profile image updated successfully';
                        $scope.success = true;
                        // Reset file input
                        input.value = '';
                    });
                    $timeout(function() {
                        $scope.message = '';
                    }, 3000);
                } else {
                    $scope.$apply(function() {
                        $scope.message = response.data.message || 'Error updating profile image';
                        $scope.success = false;
                        input.value = '';
                    });
                    $timeout(function() {
                        $scope.message = '';
                    }, 3000);
                }
            })
            .catch(function(error) {
                $scope.$apply(function() {
                    $scope.message = error.data?.message || 'Error updating profile image';
                    $scope.success = false;
                });
                $timeout(function() {
                    $scope.message = '';
                }, 3000);
            });
        };
    }); 