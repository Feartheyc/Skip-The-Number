import tensorflow as tf
from tensorflow.keras import layers, models

# 1. Load the dataset from your directory
train_ds = tf.keras.utils.image_dataset_from_directory(
    'roman_dataset',
    validation_split=0.2,
    subset="training",
    seed=123,
    image_size=(64, 64),
    batch_size=32,
    color_mode='grayscale'
)

val_ds = tf.keras.utils.image_dataset_from_directory(
    'roman_dataset',
    validation_split=0.2,
    subset="validation",
    seed=123,
    image_size=(64, 64),
    batch_size=32,
    color_mode='grayscale'
)

# 2. Define the "Tiny" Model
model = models.Sequential([
    layers.Input(shape=(64, 64, 1)),

    layers.Conv2D(16, 3, activation='relu'),
    layers.MaxPooling2D(),

    layers.Conv2D(32, 3, activation='relu'),
    layers.MaxPooling2D(),

    layers.Flatten(),
    layers.Dense(64, activation='relu'),
    layers.Dense(5, activation='softmax')
])

model.compile(optimizer='adam',
              loss='sparse_categorical_crossentropy',
              metrics=['accuracy'])

# 3. Train
model.fit(train_ds, validation_data=val_ds, epochs=10)

# 4. Save for Web Conversion
model.save('roman_numeral_model.h5')