# EchoAI Android release ProGuard / R8 rules.

# Keep Kotlin metadata for reflection-based libraries.
-keepattributes *Annotation*, InnerClasses, Signature, SourceFile, LineNumberTable

# kotlinx.serialization: keep generated serializers.
-keepclassmembers class **$$serializer { *; }
-keepclasseswithmembers class ** {
    @kotlinx.serialization.Serializable <fields>;
}
-keep,includedescriptorclasses class ai.echoai.android.**$$serializer { *; }
-keepclassmembers class ai.echoai.android.** {
    *** Companion;
}

# OkHttp / Okio (relocated, but keep platform-conditional classes quiet).
-dontwarn okhttp3.**
-dontwarn okio.**
-dontwarn org.conscrypt.**
-dontwarn org.bouncycastle.**
-dontwarn org.openjsse.**

# dnsjava uses reflection for resolver configuration.
-dontwarn org.xbill.DNS.**
-keep class org.xbill.DNS.** { *; }

# AndroidX security-crypto / Tink reflection.
-dontwarn com.google.crypto.tink.**
-keep class com.google.crypto.tink.** { *; }

# Keep Compose runtime annotations.
-keep class androidx.compose.runtime.** { *; }
