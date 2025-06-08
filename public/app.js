angular.module('vulnerableApp', [])
    .controller('LoginController', function($scope, $http, $window) {
        $scope.credentials = {
            username: '',
            password: ''
        };

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
                    $scope.trustedUsername = $sce.trustAsHtml(response.data.user.username);
                } else {
                    $window.location.href = '/';
                }
            })
            .catch(function() {
                $window.location.href = '/';
            });

        $scope.cart = [];
        $scope.showCart = false;
        
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
                name: 'HUH cat',
                description: 'An energetic kitten ready to play and bring joy to your life.',
                price: 149.99,
                image: '/assets/images/cat2.jpg'
            },
            {
                id: 3,
                name: 'Confused Cat',
                description: 'A regal cat with an elegant pose, perfect for cat enthusiasts.',
                price: 199.99,
                image: '/assets/images/cat3.jpg'
            },
            {
                id: 4,
                name: 'Scared Cat',
                description: 'A curious cat exploring its surroundings, full of personality.',
                price: 129.99,
                image: '/assets/images/cat4.png'
            },
            {
                id: 5,
                name: 'Crunchy Cat',
                description: 'A comfortable cat enjoying its favorite spot, bringing warmth to your home.',
                price: 179.99,
                image: '/assets/images/cat5.jpg'
            },
            {
                id: 6,
                name: 'Shower Cat',
                description: 'An adventurous cat ready for new experiences and discoveries.',
                price: 159.99,
                image: '/assets/images/cat6.jpg'
            }
        ];

        $scope.addToCart = function(product) {
            // Check if product already exists in cart
            const existingItem = $scope.cart.find(item => item.id === product.id);
            if (existingItem) {
                existingItem.quantity++;
            } else {
                // Add new item with quantity 1
                const cartItem = { ...product, quantity: 1 };
                $scope.cart.push(cartItem);
            }
            $scope.showCart = true;
        };

        $scope.removeFromCart = function(index) {
            $scope.cart.splice(index, 1);
        };

        $scope.getTotal = function() {
            const total = $scope.cart.reduce((total, item) => total + (item.price * item.quantity), 0);
            return parseFloat(total.toFixed(2));
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

        $scope.checkout = function() {
            // Store cart in sessionStorage for checkout page
            sessionStorage.setItem('cart', JSON.stringify($scope.cart));
            $window.location.href = '/checkout.html';
        };

        $scope.goToCheckout = function() {
            $scope.checkout();
        };

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
                    $scope.trustedUsername = $sce.trustAsHtml(response.data.user.username);
                } else {
                    $window.location.href = '/';
                }
            })
            .catch(function() {
                $window.location.href = '/';
            });

        $scope.cart = JSON.parse(sessionStorage.getItem('cart') || '[]');
        // Ensure all cart items have quantity property
        $scope.cart.forEach(item => {
            if (!item.quantity) {
                item.quantity = 1;
            }
        });
        $scope.processing = false;
        $scope.message = '';
        $scope.success = false;

        $scope.getTotal = function() {
            const total = $scope.cart.reduce((total, item) => total + (item.price * item.quantity), 0);
            return parseFloat(total.toFixed(2));
        };

        $scope.removeFromCart = function(index) {
            $scope.cart.splice(index, 1);
            sessionStorage.setItem('cart', JSON.stringify($scope.cart));
        };

        // Add quantity control functions
        $scope.increaseQuantity = function(index) {
            $scope.cart[index].quantity++;
            sessionStorage.setItem('cart', JSON.stringify($scope.cart));
        };

        $scope.decreaseQuantity = function(index) {
            if ($scope.cart[index].quantity > 1) {
                $scope.cart[index].quantity--;
            } else {
                $scope.cart.splice(index, 1);
            }
            sessionStorage.setItem('cart', JSON.stringify($scope.cart));
        };

        $scope.completeCheckout = function() {
            $scope.processing = true;
            $scope.message = '';
            $scope.success = false;

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
                            
                            // Also call the image endpoint (for LFI testing)
                            // If no profile image, leave file parameter empty
                            const fileParam = $scope.user.profile_image ? '' : '';
                            $http.get('/api/user/' + userId + '/image?file=' + fileParam)
                                .then(function(imageResponse) {
                                    // This call is just for demonstration/testing
                                    // The actual image display uses the existing profile_image field
                                    console.log('Image endpoint called successfully');
                                })
                                .catch(function(imageError) {
                                    // Silently fail - this is just for testing purposes
                                    console.log('Image endpoint call failed (expected for empty profiles)');
                                });
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
                email: $scope.user.email,
                role: $scope.user.role // Vulnerable: Include role parameter (hidden from UI but modifiable)
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

        $scope.goToAdmin = function() {
            $window.location.href = '/admin.html';
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
    })
    .controller('AdminController', function($scope, $http, $window, $timeout) {
        // Check if user is admin
        $http.get('/api/session')
            .then(function(response) {
                if (response.data.success) {
                    const user = response.data.user;
                    $scope.currentUserId = user.userId;
                    
                    // Check if user has admin role
                    if (user.role !== 'admin') {
                        $scope.showNotification('Access denied. Admin privileges required.', false);
                        $timeout(function() {
                            $window.location.href = '/profile.html';
                        }, 2000);
                        return;
                    }
                    
                    // Load all users
                    $scope.loadUsers();
                } else {
                    $window.location.href = '/';
                }
            })
            .catch(function() {
                $window.location.href = '/';
            });

        $scope.loadUsers = function() {
            $http.get('/api/users')
                .then(function(response) {
                    if (response.data.success) {
                        $scope.users = response.data.users;
                    } else {
                        $scope.showNotification('Error loading users', false);
                    }
                })
                .catch(function(error) {
                    console.error('Error loading users:', error);
                    $scope.showNotification('Error loading users', false);
                });
        };

        $scope.resetPassword = function(userId, username) {
            const newPassword = prompt('Enter new password for user "' + username + '":');
            if (!newPassword) {
                return; // User cancelled or entered empty password
            }

            if (newPassword.length < 1) {
                $scope.showNotification('Password cannot be empty', false);
                return;
            }

            if (confirm('Are you sure you want to reset the password for user "' + username + '"?')) {
                $http.put('/api/user/' + userId + '/reset-password', { 
                    newPassword: newPassword 
                })
                .then(function(response) {
                    if (response.data.success) {
                        $scope.showNotification('Password reset successfully for user "' + username + '"', true);
                    } else {
                        $scope.showNotification(response.data.message || 'Error resetting password', false);
                    }
                })
                .catch(function(error) {
                    console.error('Error resetting password:', error);
                    $scope.showNotification(error.data?.message || 'Error resetting password', false);
                });
            }
        };

        $scope.deleteUser = function(userId, username) {
            if (userId === $scope.currentUserId) {
                $scope.showNotification('You cannot delete yourself', false);
                return;
            }

            if (confirm('Are you sure you want to delete user "' + username + '"? This action cannot be undone.')) {
                $http.delete('/api/user/' + userId)
                    .then(function(response) {
                        if (response.data.success) {
                            $scope.showNotification('User "' + username + '" deleted successfully', true);
                            $scope.loadUsers(); // Reload the users list
                        } else {
                            $scope.showNotification(response.data.message || 'Error deleting user', false);
                        }
                    })
                    .catch(function(error) {
                        console.error('Error deleting user:', error);
                        $scope.showNotification(error.data?.message || 'Error deleting user', false);
                    });
            }
        };

        $scope.getAdminCount = function() {
            if (!$scope.users) return 0;
            return $scope.users.filter(user => user.role === 'admin').length;
        };

        $scope.getUserCount = function() {
            if (!$scope.users) return 0;
            return $scope.users.filter(user => user.role === 'user').length;
        };

        $scope.showNotification = function(message, isSuccess) {
            $scope.message = message;
            $scope.success = isSuccess;
            $timeout(function() {
                $scope.message = '';
            }, 3000);
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
    }); 