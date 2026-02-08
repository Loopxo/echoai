import SwiftUI

struct SettingsView: View {
    @AppStorage("serverURL") private var serverURL = "http://localhost:3000"
    @AppStorage("apiKey") private var apiKey = ""
    @AppStorage("selectedProvider") private var selectedProvider = "anthropic"
    @Environment(\.dismiss) private var dismiss
    
    let providers = ["anthropic", "openai", "google", "ollama"]
    
    var body: some View {
        NavigationView {
            Form {
                Section("Server") {
                    TextField("Server URL", text: $serverURL)
                        .textContentType(.URL)
                        .autocapitalization(.none)
                }
                
                Section("Provider") {
                    Picker("Provider", selection: $selectedProvider) {
                        ForEach(providers, id: \.self) { provider in
                            Text(provider.capitalized).tag(provider)
                        }
                    }
                    .pickerStyle(.segmented)
                    
                    SecureField("API Key", text: $apiKey)
                }
                
                Section("About") {
                    HStack {
                        Text("Version")
                        Spacer()
                        Text("1.0.0")
                            .foregroundColor(.secondary)
                    }
                }
            }
            .navigationTitle("Settings")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }
}

#Preview {
    SettingsView()
}
