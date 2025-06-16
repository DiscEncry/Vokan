package vokan.vercel.app;

import com.getcapacitor.BridgeActivity;
import io.capawesome.capacitorjs.plugins.firebase.authentication.FirebaseAuthenticationPlugin;

public class MainActivity extends BridgeActivity {
    public MainActivity() {
        super();
        registerPlugin(FirebaseAuthenticationPlugin.class);
    }
}
