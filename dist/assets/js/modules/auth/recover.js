// Imala OS - Password Recovery Logic

document.addEventListener('DOMContentLoaded', () => {
    console.log("Password recovery script loaded");
    
    const recoverForm = document.querySelector('form'); 
    const emailInput = document.getElementById('email');

    if (recoverForm) {
        recoverForm.addEventListener('submit', (e) => {
            e.preventDefault();
            
            const email = emailInput.value.trim();
            
            if (!email) {
                alert('Por favor ingresa tu correo electrónico');
                return;
            }

            // Validate email format
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                alert('Por favor ingresa un correo electrónico válido');
                return;
            }

            // Show loading state
            const submitButton = recoverForm.querySelector('button[type="submit"]');
            const originalText = submitButton.textContent;
            submitButton.disabled = true;
            submitButton.innerHTML = '<i class="mdi mdi-loading mdi-spin"></i> Enviando...';

            // Send password reset email
            window.Imala.auth.sendPasswordResetEmail(email)
                .then(() => {
                    // Success
                    alert('✅ ¡Correo enviado! Revisa tu bandeja de entrada para restablecer tu contraseña.');
                    emailInput.value = '';
                    
                    // Redirect to login after 2 seconds
                    setTimeout(() => {
                        window.location.href = 'auth-login.html';
                    }, 2000);
                })
                .catch((error) => {
                    console.error('Error sending password reset email:', error);
                    
                    let errorMessage = 'Error al enviar el correo de recuperación';
                    
                    // Handle specific error codes
                    switch (error.code) {
                        case 'auth/user-not-found':
                            errorMessage = 'No existe una cuenta con este correo electrónico';
                            break;
                        case 'auth/invalid-email':
                            errorMessage = 'El correo electrónico no es válido';
                            break;
                        case 'auth/too-many-requests':
                            errorMessage = 'Demasiados intentos. Por favor intenta más tarde';
                            break;
                        default:
                            errorMessage = `Error: ${error.message}`;
                    }
                    
                    alert('❌ ' + errorMessage);
                })
                .finally(() => {
                    // Reset button state
                    submitButton.disabled = false;
                    submitButton.textContent = originalText;
                });
        });
    }
});
