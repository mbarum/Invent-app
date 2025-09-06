
declare namespace google {
  namespace accounts {
    namespace id {
      /**
       * The response object returned by the callback function of `initialize`.
       */
      interface CredentialResponse {
        /**
         * The base64-encoded ID token JWT string.
         */
        credential?: string;
        /**
         * A string that indicates how the user selected the credential.
         */
        select_by?: 'auto' | 'user' | 'user_1tap' | 'user_2tap' | 'btn' | 'btn_confirm' | 'btn_add_session' | 'btn_confirm_add_session';
        /**
         * The client ID of your application.
         */
        clientId?: string;
      }

      /**
       * Initializes the Google Identity Services client.
       * @param config The configuration object.
       */
      function initialize(config: { 
        client_id: string; 
        callback: (response: CredentialResponse) => void; 
        use_fedcm_for_prompt?: boolean; 
      }): void;

      /**
       * Displays the One Tap prompt or the Sign In With Google button.
       */
      function prompt(): void;
    }
  }
}
