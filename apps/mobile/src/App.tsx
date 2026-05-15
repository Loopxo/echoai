import React from "react";
import { SafeAreaView, StatusBar, StyleSheet, Text, View } from "react-native";

import { createEchoAIMobileClient } from "./api";
import { HomeScreen } from "./screens/HomeScreen";

const clientFactoryReady = typeof createEchoAIMobileClient === "function";

export default function App() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />
      <View style={styles.app}>
        <Text style={styles.brand}>EchoAI</Text>
        <HomeScreen apiReady={clientFactoryReady} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#101418",
  },
  app: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  brand: {
    color: "#F7FAFC",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 16,
  },
});
