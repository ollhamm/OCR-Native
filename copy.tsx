import React, { useState, useEffect } from "react";
import { View, Button, Image, StyleSheet, Platform } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { jsPDF } from "jspdf";
import "jspdf-autotable";
import * as FileSystem from "expo-file-system";

const defaultFields = [
  "Hct",
  "RBCs",
  "Pit",
  "WBCs",
  "Neutrophils",
  "Segs",
  "Bands",
  "Lymphocytes",
  "Monocytes",
  "Eosinophils",
  "Basophils",
  "ESR",
  "Fe",
  "Fe Sat",
  "FDP",
  "Ferritin",
  "Fibrinogen",
  "Haptoglobin",
  "Hgb",
  "MCH",
  "MCHC",
  "MCV",
  "PT",
  "aPTT",
  "Reticulocytes",
  "TIBC",
  "Transferrin",
];

const HomeScreen: React.FC = () => {
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean>(false);

  useEffect(() => {
    (async () => {
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      setHasPermission(status === "granted");
    })();
  }, []);

  const handleTakePhoto = async () => {
    if (hasPermission) {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        base64: true,
      });

      if (!result.canceled) {
        const manipulatedImage = await ImageManipulator.manipulateAsync(
          result.assets[0].uri,
          [{ resize: { width: 800, height: 1000 } }],
          {
            compress: 0.7,
            format: ImageManipulator.SaveFormat.JPEG,
            base64: true,
          }
        );

        setImageUri(manipulatedImage.uri);
        const imageData = `data:image/jpeg;base64,${manipulatedImage.base64}`;
        sendToOCRSpace(imageData);
      }
    } else {
      console.log("Camera permission not granted");
    }
  };

  const handleChoosePhoto = async () => {
    if (hasPermission) {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        base64: true,
      });

      if (!result.canceled) {
        const manipulatedImage = await ImageManipulator.manipulateAsync(
          result.assets[0].uri,
          [{ resize: { width: 1000, height: 1000 } }],
          {
            compress: 0.7,
            format: ImageManipulator.SaveFormat.JPEG,
            base64: true,
          }
        );

        setImageUri(manipulatedImage.uri);
        const imageData = `data:image/jpeg;base64,${manipulatedImage.base64}`;
        sendToOCRSpace(imageData);
      }
    } else {
      console.log("Media library permission not granted");
    }
  };

  const sendToOCRSpace = async (imageData: string) => {
    const apiKey = "K81660795288957";
    const formData = new FormData();
    formData.append("base64Image", imageData);
    formData.append("language", "eng");
    formData.append("isOverlayRequired", "false");
    formData.append("isTable", "true");
    formData.append("scale", "true");

    try {
      const response = await fetch("https://api.ocr.space/parse/image", {
        method: "POST",
        headers: {
          apikey: apiKey,
        },
        body: formData,
      });
      const data = await response.json();
      console.log("OCR Response: ", data);

      if (data.OCRExitCode === 1) {
        const parsedText = data.ParsedResults[0].ParsedText;
        console.log("Parsed Text: ", parsedText);

        const textLines = parsedText
          .split("\n")
          .map((line: string) => line.trim())
          .filter((line: string) => line !== "");
        console.log("Text Lines: ", textLines);

        generatePDF(textLines);
      } else {
        console.error("OCR API Error: ", data.ErrorMessage);
      }
    } catch (error) {
      console.error("Error:", error);
    }
  };

  const processTextLines = (lines: string[]): { [key: string]: string } => {
    const combinedText = lines.join(" ").replace(/\s+/g, " ").trim();
    console.log("Combined Text: ", combinedText);

    const parts = combinedText.split(/ (?=\d|[A-Za-z])/); // Split based on spaces before numbers or words

    const result: { [key: string]: string } = {};
    let fieldIndex = 0;

    const fieldValues: string[] = [];
    const defaultFieldCount = defaultFields.length;

    parts.forEach((part, index) => {
      if (isNaN(Number(part))) {
        // Assume part is a field
        if (fieldIndex < defaultFieldCount) {
          fieldValues[fieldIndex] = part;
        }
      } else {
        // Assume part is a value
        if (fieldIndex < defaultFieldCount) {
          result[defaultFields[fieldIndex]] = part;
          fieldIndex++;
        }
      }
    });

    defaultFields.forEach((field) => {
      if (result[field] === undefined) {
        result[field] = "";
      }
    });

    return result;
  };

  const generatePDF = async (textLines: string[]) => {
    const doc = new jsPDF();

    const fieldsValues = processTextLines(textLines);
    const tableData = defaultFields.map((defaultField) => ({
      field: defaultField,
      value: fieldsValues[defaultField] || "",
    }));

    console.log("Table Data: ", tableData);

    doc.text("Hematology", 10, 10);
    doc.autoTable({
      head: [["Field", "Result"]],
      body: tableData.map((row) => [row.field, row.value]),
      startY: 20,
    });

    const pdfOutput = doc.output("arraybuffer");

    const fileUri = `${FileSystem.documentDirectory}output.pdf`;
    const base64Data = `data:application/pdf;base64,${Buffer.from(
      pdfOutput
    ).toString("base64")}`;

    try {
      await FileSystem.writeAsStringAsync(fileUri, base64Data, {
        encoding: FileSystem.EncodingType.Base64,
      });
      console.log("PDF saved to:", fileUri);
    } catch (error) {
      console.error("Error saving PDF:", error);
    }
  };

  return (
    <View style={styles.container}>
      <Button title="Take Photo" onPress={handleTakePhoto} />
      <Button title="Choose Photo" onPress={handleChoosePhoto} />
      {imageUri && <Image source={{ uri: imageUri }} style={styles.image} />}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  image: {
    width: 200,
    height: 200,
    marginTop: 20,
  },
});

export default HomeScreen;
