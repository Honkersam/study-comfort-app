package app.studycomfort.protogen;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.os.Build;
import android.os.Bundle;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Auto-grant HTML5 webview permissions (Microphone/Audio/Camera) once Android system permission is granted
        WebView webView = this.getBridge().getWebView();
        if (webView != null) {
            webView.setWebChromeClient(new WebChromeClient() {
                @Override
                public void onPermissionRequest(final PermissionRequest request) {
                    runOnUiThread(new Runnable() {
                        @Override
                        public void run() {
                            request.grant(request.getResources());
                        }
                    });
                }
            });
        }

        // Create High Priority Notification Channel for Heads-Up Banners
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            String channelId = "comfort_alerts";
            CharSequence name = "High Importance Study Reminders";
            String description = "Triggers heads-up banners, sound, and high urgency vibration for study breaks";
            int importance = NotificationManager.IMPORTANCE_HIGH;

            NotificationChannel channel = new NotificationChannel(channelId, name, importance);
            channel.setDescription(description);
            channel.enableVibration(true);
            channel.setVibrationPattern(new long[]{0, 300, 100, 300, 100, 300});

            NotificationManager notificationManager = getSystemService(NotificationManager.class);
            if (notificationManager != null) {
                notificationManager.createNotificationChannel(channel);
            }
        }
    }
}
